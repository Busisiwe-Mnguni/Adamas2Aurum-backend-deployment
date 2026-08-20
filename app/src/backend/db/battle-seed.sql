SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE battle_turns;
TRUNCATE TABLE battle_decks;
TRUNCATE TABLE battles;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO battles (battle_id, player1_id, player2_id, winner_id, status, started_at, ended_at) VALUES
(1, 1, 2, 1, 'COMPLETED', '2026-01-05 10:00:00', '2026-01-05 10:15:00');

INSERT INTO battle_decks (deck_id, battle_id, user_id, card_id, slot_position) VALUES
(1, 1, 1, 1, 1),
(2, 1, 2, 2, 1);

INSERT INTO battle_turns (turn_id, battle_id, turn_number, acting_user_id, card_played_id, action, damage_dealt, effect_desc) VALUES
(1, 1, 1, 1, 1, 'ATTACK', 45, 'Barney Barnato strikes with Market Cornering.'),
(2, 1, 2, 2, 2, 'DEFEND', 0, 'Mine Shaft braces for impact.');
