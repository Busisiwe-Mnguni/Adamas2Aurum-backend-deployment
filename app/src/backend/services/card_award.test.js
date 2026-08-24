// ============================================================
//  User Story 8 — once-only card award, edge-case tests.
//
//  These are the literal cases the ticket asks for, run against the
//  award logic with a mocked transaction connection (no live DB
//  needed — the service is pure given a `conn` with a `.query()`):
//
//    1. First correct answer → card awarded
//    2. Retry after win, correct again → no second card, attempt still
//       logged (the route always inserts trivia_attempts; here we
//       assert the award step is a no-op)
//    3. Retry after loss → the prior WRONG attempt must NOT block a
//       later correct answer from earning the card
//    4. Two near-simultaneous first attempts → only one card issued
//       (the UNIQUE(user_id, event_id) backstop rejects the loser)
// ============================================================

import { jest } from '@jest/globals'

import {
  canAwardCard,
  getEventCard,
  awardCardIfEligible,
} from './card_award.js'

// A sample card row as the JOIN in getEventCard would return it.
const SAMPLE_CARD = {
  card_id: 1,
  name: 'Barney Barnato',
  image_url: 'https://example.com/cards/barnato.png',
  rarity: 'RARE',
  category: 'CHARACTER',
  pool_id: 1,
  global_copy_limit: 50,
  copies_awarded: 1,
}

/**
 * Build a fake transaction connection. `query(sql, params)` inspects the
 * SQL it receives and returns canned [rows], recording side-effecting
 * INSERT/UPDATE calls on `conn.calls` so tests can assert they fired.
 *
 * @param {object} opts
 * @param {boolean} opts.priorWin   whether a prior correct attempt exists
 * @param {object|null} opts.card   the card getEventCard returns (null = none)
 * @param {boolean} opts.dupOnInsert  simulate a concurrent INSERT losing
 *                                   the UNIQUE-backstop race (ER_DUP_ENTRY)
 */
function makeConn({ priorWin = false, card = null, dupOnInsert = false } = {}) {
  const calls = { awardInsert: 0, userCardsUpsert: 0, copiesUpdate: 0 }
  const conn = {
    calls,
    query: jest.fn(async (sql) => {
      // Collapse internal whitespace so multi-line SQL in the service
      // (e.g. "SELECT 1\n   FROM trivia_attempts") still matches the
      // single-space prefixes checked below.
      const q = String(sql).trim().toLowerCase().replace(/\s+/g, ' ')

      // canAwardCard: SELECT 1 FROM trivia_attempts ... is_correct = TRUE
      if (q.startsWith('select 1 from trivia_attempts')) {
        return [priorWin ? [{ 1: 1 }] : []]
      }
      // getEventCard: SELECT c.card_id ... FROM event_card_pool ...
      if (q.startsWith('select c.card_id')) {
        return [card ? [card] : []]
      }
      // award ledger insert — the UNIQUE(user_id, event_id) backstop
      if (q.startsWith('insert into event_card_awards')) {
        calls.awardInsert++
        if (dupOnInsert) {
          const err = new Error(
            "Duplicate entry '1-1' for key 'uq_eca'"
          )
          err.code = 'ER_DUP_ENTRY'
          throw err
        }
        return [{ insertId: 1, affectedRows: 1 }]
      }
      // inventory upsert
      if (q.startsWith('insert into user_cards')) {
        calls.userCardsUpsert++
        return [{ affectedRows: 1 }]
      }
      // copies_awarded increment
      if (q.startsWith('update event_card_pool set copies_awarded')) {
        calls.copiesUpdate++
        return [{ affectedRows: 1 }]
      }
      return [[]]
    }),
  }
  return conn
}

// ------------------------------------------------------------
// canAwardCard — the source-of-truth "has this player won?" check
// ------------------------------------------------------------
describe('canAwardCard', () => {
  test('returns true (eligible) when the player has never won this event', async () => {
    const conn = makeConn({ priorWin: false })
    expect(await canAwardCard(conn, 1, 1)).toBe(true)
  })

  test('returns false (ineligible) once a prior correct attempt exists', async () => {
    const conn = makeConn({ priorWin: true })
    expect(await canAwardCard(conn, 1, 1)).toBe(false)
  })

  test('a prior WRONG attempt does not block eligibility (retry-after-loss path)', async () => {
    // canAwardCard only reads is_correct = TRUE rows. A wrong attempt
    // yields an empty result here, so the player may still earn the
    // card when they eventually answer correctly — matching the
    // ticket's "a player who lost can retry until they win".
    const conn = makeConn({ priorWin: false })
    expect(await canAwardCard(conn, 1, 1)).toBe(true)
  })
})

// ------------------------------------------------------------
// getEventCard — which card the event awards
// ------------------------------------------------------------
describe('getEventCard', () => {
  test('returns the first pool card that still has copies available', async () => {
    const conn = makeConn({ card: SAMPLE_CARD })
    const card = await getEventCard(conn, 1)
    expect(card).toMatchObject({
      card_id: 1,
      name: 'Barney Barnato',
      rarity: 'RARE',
    })
  })

  test('returns null when the event has no awardable card configured', async () => {
    const conn = makeConn({ card: null })
    expect(await getEventCard(conn, 1)).toBeNull()
  })
})

// ------------------------------------------------------------
// awardCardIfEligible — the atomic check-and-award, all four
// ticket scenarios
// ------------------------------------------------------------
describe('awardCardIfEligible', () => {
  test('scenario 1 — first correct answer awards the card', async () => {
    const conn = makeConn({ priorWin: false, card: SAMPLE_CARD })
    const result = await awardCardIfEligible(conn, {
      user_id: 1,
      event_id: 1,
    })

    expect(result.awarded).toBe(true)
    expect(result.reason).toBe('AWARDED')
    expect(result.card_id).toBe(1)
    expect(result.card.name).toBe('Barney Barnato')

    // Award ledger row written, inventory upserted, copies bumped.
    expect(conn.calls.awardInsert).toBe(1)
    expect(conn.calls.userCardsUpsert).toBe(1)
    expect(conn.calls.copiesUpdate).toBe(1)
  })

  test('scenario 2 — retry after a prior win awards NO second card', async () => {
    const conn = makeConn({ priorWin: true, card: SAMPLE_CARD })
    const result = await awardCardIfEligible(conn, {
      user_id: 1,
      event_id: 1,
    })

    expect(result.awarded).toBe(false)
    expect(result.reason).toBe('ALREADY_EARNED')
    expect(result.card_id).toBeNull()

    // Nothing written — the attempt itself is still logged by the
    // route (trivia_attempts), but the award step is a complete no-op.
    expect(conn.calls.awardInsert).toBe(0)
    expect(conn.calls.userCardsUpsert).toBe(0)
    expect(conn.calls.copiesUpdate).toBe(0)
  })

  test('scenario 3 — retry after a loss still earns the card on the winning attempt', async () => {
    // The only prior attempt was WRONG, so canAwardCard sees no prior
    // win and the player is eligible. This is the "retry until they
    // win, but only gets the card once, on the attempt that succeeds"
    // path from the ticket.
    const conn = makeConn({ priorWin: false, card: SAMPLE_CARD })
    const result = await awardCardIfEligible(conn, {
      user_id: 1,
      event_id: 1,
    })

    expect(result.awarded).toBe(true)
    expect(result.reason).toBe('AWARDED')
    expect(conn.calls.awardInsert).toBe(1)
  })

  test('event with no awardable card awards nothing and does not throw', async () => {
    const conn = makeConn({ priorWin: false, card: null })
    const result = await awardCardIfEligible(conn, {
      user_id: 1,
      event_id: 1,
    })

    expect(result.awarded).toBe(false)
    expect(result.reason).toBe('NO_CARD_CONFIGURED')
    expect(conn.calls.awardInsert).toBe(0)
    expect(conn.calls.userCardsUpsert).toBe(0)
  })

  test('scenario 4 — two near-simultaneous first attempts: the race loser gets no card', async () => {
    // Simulates a concurrent double-submit: both passed canAwardCard
    // before either wrote, but the UNIQUE(user_id, event_id) backstop
    // on event_card_awards rejects the second INSERT with ER_DUP_ENTRY.
    const conn = makeConn({
      priorWin: false,
      card: SAMPLE_CARD,
      dupOnInsert: true,
    })
    const result = await awardCardIfEligible(conn, {
      user_id: 1,
      event_id: 1,
    })

    // The loser must NOT receive a card, and must NOT touch inventory
    // or the copies counter — only the winner does that.
    expect(result.awarded).toBe(false)
    expect(result.reason).toBe('RACE_LOST')
    expect(result.card_id).toBeNull()
    expect(conn.calls.userCardsUpsert).toBe(0)
    expect(conn.calls.copiesUpdate).toBe(0)
  })

  test('a real (non-duplicate) DB error re-throws so the transaction rolls back', async () => {
    // Only ER_DUP_ENTRY is treated as a benign race loss. Any other
    // error must propagate so the caller's transaction rolls back
    // (a silently-swallowed error could leave a card half-awarded).
    const conn = makeConn({ priorWin: false, card: SAMPLE_CARD })
    conn.query = jest.fn(async (sql) => {
      const q = String(sql).trim().toLowerCase().replace(/\s+/g, ' ')
      if (q.startsWith('select 1 from trivia_attempts')) return [[]]
      if (q.startsWith('select c.card_id')) return [[SAMPLE_CARD]]
      if (q.startsWith('insert into event_card_awards')) {
        const err = new Error('Connection lost during query')
        err.code = 'ECONNRESET'
        throw err
      }
      return [[]]
    })

    await expect(
      awardCardIfEligible(conn, { user_id: 1, event_id: 1 })
    ).rejects.toThrow('Connection lost during query')
    expect(conn.calls.userCardsUpsert).toBe(0)
    expect(conn.calls.copiesUpdate).toBe(0)
  })
})
