// ============================================================
//  ONCE-ONLY CARD AWARD  (User Story 8)
//
//  A player receives the card tied to an event the FIRST time they
//  answer correctly. Retries afterward — whether they previously won
//  or lost — never issue a second card.
//
//  Design (straight from the ticket):
//   1. The attempt log (trivia_attempts.is_correct = TRUE) is the
//      source of truth for "has this player ever won here?". We do NOT
//      answer that by checking card ownership — a player could trade
//      or lose a card, or duplicate-card mechanics could be added
//      later. Ownership is a downstream consequence, not a signal.
//   2. canAwardCard() is checked BEFORE the attempt is recorded. That
//      ordering matters: a winning retry-after-win must see the prior
//      win, so it must be queried before the new attempt is inserted.
//   3. The whole check-and-award runs inside one DB transaction, and
//      event_card_awards has a UNIQUE(user_id, event_id) constraint as
//      a hard backstop: even if two requests both pass the eligibility
//      check before either writes, only one INSERT succeeds — the
//      other throws ER_DUP_ENTRY and is caught, so the loser gets no
//      card instead of a duplicate.
//
//  Table mapping (the schema already realises the ticket's EventAttempt
//  design — no new table is needed):
//    trivia_attempts       = EventAttempt  (id, player_id, event_id,
//                              is_correct, card_awarded_id, attempted_at)
//    event_card_awards     = the authoritative award ledger, with the
//                              UNIQUE(user_id, event_id) backstop
//    event_card_pool       = which card(s) an event awards
//    user_cards            = the player's inventory (quantity-tracked)
// ============================================================

/**
 * Has this player ever answered this event correctly?
 *
 * Returns true when the player MAY still earn a card (no prior win),
 * false once they've won before — regardless of how many times they
 * retry or whether they still own the card.
 *
 * @param {import('mysql2/promise').Pool|Connection} conn  a pool, or a
 *   transaction-bound connection (the latter inside awardCardIfEligible)
 */
export async function canAwardCard(conn, user_id, event_id) {
    const [rows] = await conn.query(
        `SELECT 1
       FROM trivia_attempts
      WHERE user_id = ? AND event_id = ? AND is_correct = TRUE
      LIMIT 1`,
        [user_id, event_id],
    );
    // eligible = no prior correct attempt on record
    return rows.length === 0;
}

/**
 * The card this event awards right now — the first pool entry that
 * still has copies available (global_copy_limit not yet reached, or
 * NULL meaning unlimited).
 *
 * Selection is deterministic (lowest pool_id) rather than weighted
 * random: the once-only story only cares that *a* card is issued at
 * most once per player+event, and a deterministic pick keeps the
 * award path trivially testable. Weighted draws are a separate concern.
 *
 * Returns the joined card row (with pool_id for the copies counter),
 * or null if the event has no awardable card configured.
 */
export async function getEventCard(conn, event_id) {
    const [rows] = await conn.query(
        `SELECT c.card_id, c.name, c.image_url, c.rarity, c.category,
            ecp.pool_id, ecp.global_copy_limit, ecp.copies_awarded
       FROM event_card_pool ecp
       JOIN cards c ON ecp.card_id = c.card_id
      WHERE ecp.event_id = ?
        AND (ecp.global_copy_limit IS NULL
             OR ecp.copies_awarded < ecp.global_copy_limit)
      ORDER BY ecp.pool_id ASC
      LIMIT 1`,
        [event_id],
    );
    return rows[0] || null;
}

/**
 * Atomic check-and-award. MUST be called inside an open transaction
 * (the caller manages begin/commit/rollback) so the eligibility check,
 * the award-ledger insert, the inventory upsert, and the copies_awarded
 * increment all commit together — or none do.
 *
 * The caller records the attempt (trivia_attempts.card_awarded_id)
 * using the returned card_id (or NULL) AFTER this returns, still
 * inside the same transaction. That ordering (check → award → log
 * attempt) is what makes a winning retry-after-win see the prior win.
 *
 * @returns {{
 *   awarded: boolean,
 *   card: {card_id:number,name:string,image_url:string,rarity:string,category:string}|null,
 *   card_id: number|null,
 *   reason: 'AWARDED'|'ALREADY_EARNED'|'NO_CARD_CONFIGURED'|'RACE_LOST'
 * }}
 */
export async function awardCardIfEligible(conn, { user_id, event_id }) {
    // 1. Eligibility — has the player ever won this event before?
    const eligible = await canAwardCard(conn, user_id, event_id);
    if (!eligible) {
        return {
            awarded: false,
            card: null,
            card_id: null,
            reason: "ALREADY_EARNED",
        };
    }

    // 2. Which card does this event award (if any still has copies)?
    const card = await getEventCard(conn, event_id);
    if (!card) {
        return {
            awarded: false,
            card: null,
            card_id: null,
            reason: "NO_CARD_CONFIGURED",
        };
    }

    // 3. Insert the award-ledger row. UNIQUE(user_id, event_id) is the
    //    hard backstop: if two concurrent requests both passed
    //    canAwardCard before either wrote, exactly one INSERT succeeds
    //    and the other throws ER_DUP_ENTRY — caught here so the loser
    //    simply gets no card instead of crashing the request.
    try {
        await conn.query(
            `INSERT INTO event_card_awards (user_id, event_id, card_id) VALUES (?, ?, ?)`,
            [user_id, event_id, card.card_id],
        );
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            // Lost the race — another request awarded this player+event first.
            return {
                awarded: false,
                card: null,
                card_id: null,
                reason: "RACE_LOST",
            };
        }
        throw err; // a real error — let the caller roll the transaction back
    }

    // 4. Add the card to the player's inventory. ON DUPLICATE KEY UPDATE
    //    bumps the quantity if they already own a copy from another event
    //    (or a future duplicate-card mechanic) — the award ledger is what
    //    enforces "once per event", not the inventory row.
    await conn.query(
        `INSERT INTO user_cards (user_id, card_id, quantity) VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
        [user_id, card.card_id],
    );

    // 5. Account for the global copy budget, where the pool tracks one.
    await conn.query(
        `UPDATE event_card_pool SET copies_awarded = copies_awarded + 1 WHERE pool_id = ?`,
        [card.pool_id],
    );

    return {
        awarded: true,
        card: {
            card_id: card.card_id,
            name: card.name,
            image_url: card.image_url,
            rarity: card.rarity,
            category: card.category,
        },
        card_id: card.card_id,
        reason: "AWARDED",
    };
}
