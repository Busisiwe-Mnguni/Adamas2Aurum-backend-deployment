import { WebSocketServer } from 'ws'
import pool from '../utils/db.js'
import {
	load_battle_state,
	get_battle_state,
	clear_battle_state,
} from './battle_state.js'
import {
	get_effective_stat,
	apply_defence,
	apply_buff,
	apply_debuff,
	apply_defence_stance,
	apply_revive,
	tick_effects,
	TEAM_ACTIONS,
} from './battle_effects.js'

const active_players = new Map()

function get_player_connection(user_id) {
	return active_players.get(user_id) || null
}

function clear_player_connection(user_id) {
	active_players.delete(user_id)
}

async function set_battle_finished(battle_id, reason, winner = null) {
	if (battle_id === null) return
	if (!['PENDING', 'ACTIVE', 'COMPLETED', 'ABANDONED'].includes(reason))
		reason = 'ABANDONED'

	await pool.query(
		`UPDATE battles SET status = '${reason}', winner_id = ?, ended_at = NOW() WHERE battle_id = ?`,
		[winner, battle_id]
	)
}

function next_turn(state) {
	return state.turn === state.player1_id
		? state.player2_id
		: state.player1_id
}

function find_card(cards, slot_position) {
	return cards.find((c) => c.slot_position === slot_position) || null
}

function is_players_turn(state, user_id) {
	return state.turn === user_id
}

function is_valid_attacker(cards, slot_position) {
	const card = find_card(cards, slot_position)
	if (!card) return { ok: false, reason: 'No card in that slot' }
	if (card.health <= 0)
		return { ok: false, reason: 'That card is defeated' }
	return { ok: true, card }
}

function is_valid_target(action, cards, slot_position) {
	const card = find_card(cards, slot_position)
	if (!card) return { ok: false, reason: 'No opponent card in that slot' }
	if (card.health <= 0 && action != 'REVIVE')
		return { ok: false, reason: 'Target already defeated' }
	return { ok: true, card }
}

async function log_turn(
	battle_id,
	turn_number,
	acting_user_id,
	attacker,
	target,
	action,
	result
) {
	const landed = action === 'ATTACK' ? result.landed : null
	const damage = action === 'ATTACK' ? result.damage : 0

	await pool.query(
		`INSERT INTO battle_turns
		 (battle_id, turn_number, acting_user_id, deck_slot_played_id, deck_slot_targeted_id, action, damage_dealt, landed, effect_data)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			battle_id,
			turn_number,
			acting_user_id,
			attacker.deck_id,
			target.deck_id,
			action,
			damage,
			landed,
			JSON.stringify(result),
		]
	)
}

async function persist_final_health(state) {
	for (const card of [...state.cards.player1, ...state.cards.player2]) {
		await pool.query(
			'UPDATE battle_decks SET final_health = ? WHERE deck_id = ?',
			[card.health, card.deck_id]
		)
	}
}

function calculate_defence(target) {
	const target_legacy = get_effective_stat(target, 'stat_legacy')
	const target_era = get_effective_stat(target, 'stat_era')

	let current_year = 2026
	let era_age = Math.max(0, current_year - target_era)

	// adjust weights to balance era and legacy impact
	let raw_input = era_age * 0.5 + target_legacy * 0.8

	let max_cap = 30
	// lower rate to make high defense harder to achieve
	let rate = 0.015

	return max_cap * (1 - Math.exp(-rate * raw_input))
}

function resolve_attack(attacker, target) {
	const attacker_attack = get_effective_stat(attacker, 'stat_attack')
	const attacker_location = get_effective_stat(attacker, 'stat_location')
	const target_location = get_effective_stat(target, 'stat_location')

	let hit_chance = Math.min(
		0.95,
		1.0 - target_location / 100 + attacker_location / 100
	)
	if (target.category === 'LOCATION') hit_chance *= 0.9
	if (Math.random() >= hit_chance) {
		return {
			landed: false,
			damage: 0,
			target_health_after: target.health,
		}
	}

	let defence = calculate_defence(target)
	if (target.category === 'HISTORICAL') defence *= 1.1

	let damage = attacker_attack
	if (attacker.category === 'CHARACTER') damage *= 1.5
	damage = Math.max(
		1,
		apply_defence(target, Math.round(damage - defence))
	)

	target.health = Math.max(0, target.health - damage)
	return {
		landed: true,
		damage,
		target_health_after: target.health,
	}
}

function get_target_pool(player_cards, opponent_cards, action) {
	return action === 'BUFF' || action === 'REVIVE'
		? player_cards
		: opponent_cards
}

const ABILITY_DEFAULTS = { stat: 'stat_attack', amount: 10, duration: 2 }

function resolve_action(attacker, target, action) {
	switch (action) {
		case 'ATTACK':
			return resolve_attack(attacker, target)
		case 'DEFEND':
			return apply_defence_stance(
				attacker,
				Math.round(attacker.stat_legacy / 10)
			)
		case 'DODGE':
			return apply_buff(
				attacker,
				target,
				'stat_location',
				10,
				1
			)
		case 'BUFF':
			return apply_buff(
				attacker,
				target,
				ABILITY_DEFAULTS.stat,
				ABILITY_DEFAULTS.amount,
				ABILITY_DEFAULTS.duration
			)
		case 'DEBUFF':
			return apply_debuff(
				attacker,
				target,
				ABILITY_DEFAULTS.stat,
				ABILITY_DEFAULTS.amount,
				ABILITY_DEFAULTS.duration
			)
		case 'REVIVE':
			return apply_revive(
				target,
				Math.round(target.stat_legacy / 2),
				3
			)
		default:
			throw new Error(`Unhandled action: ${action}`)
	}
}

function is_action_valid_for_category(category, action) {
	//   INFLUENCE: ATTACK, BUFF, and DEBUFF
	//   CHARACTER:  ATTACK, and DEFEND (highest damage)
	//   LOCATION: ATTACK, DODGE, and DEFEND (skews hit/dodge chance)
	//   HISTORICAL: ATTACK, DEFEND, and reviving a defeated CHARACTER (not built yet)
	const allowed = {
		CHARACTER: ['ATTACK', 'DEFEND'],
		LOCATION: ['ATTACK', 'DODGE', 'DEFEND'],
		INFLUENCE: ['ATTACK', 'BUFF', 'DEBUFF'],
		HISTORICAL: ['ATTACK', 'DEFEND'],
	}
	return (allowed[category] || []).includes(action)
}

function take_cpu_turn(state) {
	const alive_cpu = state.cards.player2.filter((c) => c.health > 0)
	const alive_player = state.cards.player1.filter((c) => c.health > 0)
	if (!alive_cpu.length || !alive_player.length) return null

	const attacker = alive_cpu[Math.floor(Math.random() * alive_cpu.length)]
	const target =
		alive_player[Math.floor(Math.random() * alive_player.length)]
	const result = resolve_action(attacker, target, 'ATTACK')

	return {
		action: 'ATTACK',
		attacker_slot: attacker.slot_position,
		target_slot: target.slot_position,
		result,
	}
}

function check_battle_over(state) {
	if (!state.cards.player1.some((c) => c.health > 0))
		return state.player2_id
	if (!state.cards.player2.some((c) => c.health > 0))
		return state.player1_id
	return -1
}

export function find_player_battle(user_id) {
	const player_connection = get_player_connection(user_id)
	if (player_connection === null) return null
	const state = get_battle_state(player_connection.battle_id)
	if (state === null) {
		clear_player_connection(user_id)
		return null
	}
	return state.battle_id
}

export const battleWss = new WebSocketServer({ noServer: true })

battleWss.on('connection', (ws, request) => {
	const user_id = request.user.user_id
	let battle_id = null
	if (!user_id) {
		ws.close(4001, 'Unauthorized')
		return
	}

	ws.on('message', async (raw) => {
		let msg
		try {
			msg = JSON.parse(raw)
		} catch {
			return ws.send(
				JSON.stringify({
					type: 'error',
					message: 'Invalid JSON',
				})
			)
		}

		console.log(
			`[WebSocket Log] ${new Date().toISOString()} - ${request.method} ${request.url} ${msg.type}`
		)
		try {
			if (msg.type === 'ping') {
				return ws.send(
					JSON.stringify({
						type: 'pong',
					})
				)
			}

			if (msg.type === 'join_battle') {
				const state = await load_battle_state(
					pool,
					msg.battle_id
				)
				if (!state)
					return ws.send(
						JSON.stringify({
							type: 'error',
							message: 'Battle not found',
						})
					)
				if (
					state.player1_id !== user_id &&
					state.player2_id !== user_id
				)
					return ws.send(
						JSON.stringify({
							type: 'error',
							message: 'Not your battle',
						})
					)
				battle_id = msg.battle_id
				active_players.set(user_id, { ws, battle_id })
				return ws.send(
					JSON.stringify({
						type: 'battle_state',
						state,
						user_id,
					})
				)
			}

			if (msg.type === 'attack') {
				if (battle_id === null)
					return ws.send(
						JSON.stringify({
							type: 'error',
							message: 'Join a battle first',
						})
					)

				const state = get_battle_state(battle_id)
				if (!state)
					return ws.send(
						JSON.stringify({
							type: 'error',
							message: 'Battle state not loaded',
						})
					)

				let player_cards,
					opponent_cards,
					player_id,
					opponent_id
				if (user_id === state.player1_id) {
					player_id = state.player1_id
					player_cards = state.cards.player1

					opponent_id = state.player2_id
					opponent_cards = state.cards.player2
				} else {
					player_id = state.player2_id
					player_cards = state.cards.player2

					opponent_id = state.player1_id
					opponent_cards = state.cards.player1
				}
				if (!is_players_turn(state, user_id)) {
					return ws.send(
						JSON.stringify({
							type: 'error',
							message: 'Not your turn',
						})
					)
				}
				const attacker_check = is_valid_attacker(
					player_cards,
					msg.attacker_slot
				)
				if (!attacker_check.ok) {
					return ws.send(
						JSON.stringify({
							type: 'error',
							message: attacker_check.reason,
						})
					)
				}
				const target_check = is_valid_target(
					msg.action,
					TEAM_ACTIONS.includes(msg.action)
						? player_cards
						: opponent_cards,
					msg.target_slot
				)
				if (!target_check.ok) {
					return ws.send(
						JSON.stringify({
							type: 'error',
							message: target_check.reason,
						})
					)
				}
				if (
					!is_action_valid_for_category(
						attacker_check.card.category,
						msg.action
					)
				) {
					return ws.send(
						JSON.stringify({
							type: 'error',
							message: `${attacker_check.card.category} cards can't ${msg.action}`,
						})
					)
				}

				let player_result = resolve_action(
					attacker_check.card,
					target_check.card,
					msg.action
				)
				await log_turn(
					battle_id,
					state.turn_number,
					user_id,
					attacker_check.card,
					target_check.card,
					msg.action,
					player_result
				)
				player_result = {
					attacker_slot: msg.attacker_slot,
					target_slot: msg.target_slot,
					action: msg.action,
					...player_result,
				}

				let winner = check_battle_over(state)
				let opponent_result = null

				if (winner === -1) {
					state.turn = next_turn(state)

					if (opponent_id === null) {
						state.turn_number += 0.5
						const cpu_result =
							take_cpu_turn(state)
						opponent_result = {
							attacker_slot:
								cpu_result.attacker_slot,
							target_slot:
								cpu_result.target_slot,
							action: cpu_result.action,
							...cpu_result.result,
						}

						if (cpu_result) {
							await log_turn(
								battle_id,
								state.turn_number,
								null,
								opponent_cards[
									cpu_result
										.attacker_slot
								],
								player_cards[
									cpu_result
										.target_slot
								],
								cpu_result.action,
								cpu_result.result
							)
						}

						winner =
							check_battle_over(state)
						state.turn_number += 0.5
						if (state.turn_number > 1)
							tick_effects(state)
						state.turn = next_turn(state)
					} else {
						state.turn_number += 0.5
					}
				}

				ws.send(
					JSON.stringify({
						type: 'turn_result',
						player_result,
						opponent_result,
						state,
						user_id,
						winner,
					})
				)

				if (winner !== -1) {
					set_battle_finished(
						battle_id,
						'COMPLETED',
						winner
					)
					persist_final_health(state)
					clear_battle_state(battle_id)
					if (state.player1_id !== null) {
						const tmp_connection =
							get_player_connection(
								state.player1_id
							)
						const tmp_wss = tmp_connection.ws
						tmp_wss.send(
							JSON.stringify({
								type: 'match-results',
								winner,
								user_id,
							})
						)
						clear_player_connection(
							state.player1_id
						)
					}
					if (state.player2_id !== null) {
						const tmp_connection =
							get_player_connection(
								state.player2_id
							)
						const tmp_wss = tmp_connection.ws
						tmp_wss.send(
							JSON.stringify({
								type: 'match-results',
								winner,
								user_id,
							})
						)
						clear_player_connection(
							state.player2_id
						)
					}
				}
				return
			}

			ws.send(
				JSON.stringify({
					type: 'error',
					message: `Unknown message type: ${msg.type}`,
				})
			)
		} catch (err) {
			console.error('battle socket error:', err)
			ws.send(
				JSON.stringify({
					type: 'error',
					message: 'Server error',
				})
			)
		}
	})

	ws.on('error', (ev) => {
		console.log(
			`[WebSocket Error] ${new Date().toISOString()} - `,
			ev
		)
	})

	ws.on('close', (ev) => {
		console.log(
			`[WebSocket Log] ${new Date().toISOString()} - ${ev.reason} (Clean: ${ev.wasClean}) (${ev.code})`
		)
	})
})
