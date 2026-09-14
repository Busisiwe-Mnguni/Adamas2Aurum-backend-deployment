import express from "express";

import pool from "../utils/db.js";
import { error, success } from "../utils/response.js";
import {
    valid_user_cards,
    get_active_battle,
    abandon_battle,
    TURN_TIMEOUT_MS,
} from "../utils/battle.js";
import { find_player_battle } from "../websocket/battle_socket.js";

const router = express.Router();

router.use((req, res, next) => {
    console.log(
        `[Cards Router Log] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`,
    );
    next();
});

function require_auth(req, res, next) {
    if (!req.user?.user_id) {
        return res.status(401).json({ error: "Unauthorised — please log in" });
    }
    next();
}

async function build_npc_deck(battle_id) {
    const [cards] = await pool.query(
        "SELECT card_id, stat_legacy FROM cards ORDER BY RAND() LIMIT 5",
    );

    if (cards.length < 5) {
        throw new Error("Not enough cards in the pool to build an NPC deck");
    }

    const values = [];
    const placeholders = cards
        .map((card, idx) => {
            values.push(battle_id, card.card_id, idx);
            return "(?, NULL, ?, ?)";
        })
        .join(",");

    const [result] = await pool.query(
        `INSERT INTO battle_decks
		 (battle_id, user_id, card_id, slot_position) VALUES
		 ${placeholders}`,
        values,
    );

    if (result.affectedRows !== 5) {
        throw new Error("Failed to build NPC deck");
    }

    return result;
}

async function start_npc_battle(req, res) {
    try {
        const [result] = await pool.query(
            `INSERT INTO battles (
				player1_id, player2_id,
				winner_id,
				status,
				started_at,
				ended_at
			) VALUES (
				?, NULL,
				NULL,
				'ACTIVE',
				CURRENT_TIMESTAMP,
				NULL
			)`,
            [req.user.user_id],
        );
        if (result.affectedRows == 0)
            return error(res, 500, "Failed to start battle");

        const battle_id = result.insertId;
        await build_npc_deck(battle_id);

        success(res, { battle_id });
    } catch (err) {
        console.error(err);
        error(res, 500, "Failed to start battle");
    }
}

router.get("/start-battle", require_auth, async (req, res, next) => {
    try {
        if ((await get_active_battle(req.user.user_id)) != null)
            return error(res, 500, "Already in a battle");
        if (req.query.npc) return start_npc_battle(req, res);
        else return error(res, 500, "Unfinished route");
    } catch (err) {
        console.error(err);
        error(res, 500, err.message);
    }
});

router.get("/find-battle", require_auth, async (req, res, next) => {
    try {
        const db_battle_id = await get_active_battle(req.user.user_id);
        if (db_battle_id === null) return success(res, { battle_id: null });
        const battle_id = find_player_battle(req.user.user_id);
        if (battle_id === null) await abandon_battle(db_battle_id);
        return success(res, { battle_id });
    } catch (err) {
        console.error(err);
        error(res, 500, err.message);
    }
});

router.post("/build-battle-deck", require_auth, async (req, res, next) => {
    try {
        const battle_id = await get_active_battle(req.user.user_id);
        if (battle_id == null) return error(res, 500, "Not in a battle");
        var deck = req.body;
        if (!(await valid_user_cards(req.user, deck)) || deck.length != 5)
            error(
                res,
                500,
                "Failed to build battle deck due to invalid card selection",
            );

        const values = [];
        const placeholders = deck
            .map((card, idx) => {
                values.push(battle_id, req.user.user_id, card.card_id, idx);
                return "(?,?,?,?)";
            })
            .join(",");
        const [result] = await pool.query(
            `INSERT INTO battle_decks
			(battle_id, user_id, card_id, slot_position) VALUES
			${placeholders}
			`,
            values,
        );
        if (result.affectedRows != 5) error(res, 500, "Failed to build deck");
        success(res, result.affectedRows);
    } catch (err) {
        console.error(err);
        error(res, 500, err.message);
    }
});

export default router;
