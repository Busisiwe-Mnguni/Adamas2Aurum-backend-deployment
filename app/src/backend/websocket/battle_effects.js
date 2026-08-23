// Effect shape: { type, stat, amount, duration, source_slot }
//   type      'BUFF' | 'DEBUFF' | 'DEFEND' | 'REVIVE'
//   stat      the stat_* field it modifies, or null for non-stat effects (DEFEND, REVIVE)
//   amount    signed delta applied to the stat (BUFF positive, DEBUFF negative)
//   duration  rounds remaining; DEFEND ignores this and is consumed on hit instead

export const TEAM_ACTIONS = ['DEFEND', 'DODGE', 'REVIVE', 'BUFF'];

export function add_effect(card, effect) {
	card.effects = card.effects || []
	card.effects.push(effect)
}

export function get_effective_stat(card, stat_name) {
	const base = card[stat_name] ?? 0
	const delta = (card.effects || [])
		.filter((e) => e.stat === stat_name)
		.reduce((sum, e) => sum + e.amount, 0)
	return Math.max(0, base + delta)
}

export function apply_defence(card, incoming_damage) {
	const idx = (card.effects || []).findIndex((e) => e.type === 'DEFEND')
	if (idx === -1) return incoming_damage

	const defend = card.effects[idx]
	card.effects.splice(idx, 1)
	return Math.max(0, incoming_damage - defend.amount)
}

export function tick_effects(state) {
	for (const card of [...state.cards.player1, ...state.cards.player2]) {
		if (!card.effects?.length) continue

		const still_active = []
		for (const effect of card.effects) {
			if (effect.type === 'DEFEND') {
				still_active.push(effect)
				continue
			}

			effect.duration -= 1
			if (effect.duration > 0) {
				still_active.push(effect)
			} else if (effect.type === 'REVIVE') {
				card.health = 0 // borrowed time is up
			}
		}
		card.effects = still_active
	}
}

export function apply_buff(source, target, stat, amount, duration) {
	add_effect(target, {
		type: 'BUFF',
		stat,
		amount,
		duration,
		source_slot: source.slot_position,
	})
	return { applied: true, stat, amount, duration }
}

export function apply_debuff(source, target, stat, amount, duration) {
	add_effect(target, {
		type: 'DEBUFF',
		stat,
		amount: -Math.abs(amount),
		duration,
		source_slot: source.slot_position,
	})
	return { applied: true, stat, amount: -Math.abs(amount), duration }
}

export function apply_defence_stance(card, amount) {
	add_effect(card, { type: 'DEFEND', stat: null, amount, duration: null })
	return { applied: true, amount }
}

export function apply_revive(target, health, duration) {
	if (target.health > 0)
		return { applied: false, reason: 'Target is not defeated' }
	target.health = health
	add_effect(target, { type: 'REVIVE', stat: null, amount: 0, duration })
	return { applied: true, health, duration }
}
