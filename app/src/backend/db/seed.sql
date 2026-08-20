-- ============================================================
--  SEED DATA
--  Generated with the help of Claude using the schema.sql file.
--  Populates each table with 1-2 rows, respecting FK order.
--  Safe to re-run: clears tables first (in reverse FK order).
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE user_credentials;
TRUNCATE TABLE leaderboard_entries;
TRUNCATE TABLE seasons;
TRUNCATE TABLE user_cosmetics;
TRUNCATE TABLE cosmetics;
TRUNCATE TABLE point_transactions;
TRUNCATE TABLE trades;
TRUNCATE TABLE battle_turns;
TRUNCATE TABLE battle_decks;
TRUNCATE TABLE battles;
TRUNCATE TABLE audit_log;
TRUNCATE TABLE user_discovered_events;
TRUNCATE TABLE trivia_attempts;
TRUNCATE TABLE location_check_log;
TRUNCATE TABLE event_card_awards;
TRUNCATE TABLE user_cards;
TRUNCATE TABLE event_card_pool;
TRUNCATE TABLE cards;
TRUNCATE TABLE trivia_options;
TRUNCATE TABLE trivia_questions;
TRUNCATE TABLE events;
TRUNCATE TABLE admin_roles;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
--  1. USERS
-- ============================================================
INSERT INTO users (user_id, provider_id, email, name, avatar_url, points) VALUES
(1, 'google-oauth2|1001', 'alice@example.com', 'Alice Nkosi', 'https://example.com/avatars/alice.png', 150),
(2, 'google-oauth2|1002', 'bob@example.com',   'Bob van Wyk', 'https://example.com/avatars/bob.png',   90);

-- ============================================================
--  2. ADMIN ROLES
-- ============================================================
INSERT INTO admin_roles (role_id, user_id, role, granted_by) VALUES
(1, 1, 'SUPER_ADMIN',  NULL),
(2, 2, 'EVENT_AUTHOR', 1);

-- ============================================================
--  3. EVENTS
-- ============================================================
INSERT INTO events (event_id, title, description, latitude, longitude, radius_meters, point_threshold, point_reward, starts_at, ends_at, repeat_interval, attempt_cooldown_s, max_attempts_per_window, is_active, author_id) VALUES
(1, 'Origins of Gold Reef City', 'Trivia about the founding of the Witwatersrand gold rush.', -26.20227000, 28.04363000, 100, 0, 20, '2026-01-01 00:00:00', '2026-12-31 23:59:59', NULL, 86400, 1, TRUE, 1),
(2, 'Constitution Hill Chronicles', 'History of the old fort and Constitutional Court.', -26.19070000, 28.04120000, 75, 0, 15, '2026-01-01 00:00:00', '2026-12-31 23:59:59', NULL, 43200, 2, TRUE, 2);

-- ============================================================
--  4. TRIVIA QUESTIONS
-- ============================================================
INSERT INTO trivia_questions (question_id, event_id, format, body, time_limit_s, difficulty) VALUES
(1, 1, 'MULTIPLE_CHOICE', 'In what year was gold discovered on the Witwatersrand?', 30, 1),
(2, 2, 'TRUE_FALSE',      'The Old Fort was originally built as a women''s prison.', 20, 2);

-- ============================================================
--  5. TRIVIA OPTIONS
-- ============================================================
INSERT INTO trivia_options (option_id, question_id, body, is_correct) VALUES
(1, 1, '1886', TRUE),
(2, 1, '1901', FALSE),
(3, 1, '1652', FALSE),
(4, 2, 'False', TRUE),
(5, 2, 'True',  FALSE);

-- ============================================================
--  6. CARDS
-- ============================================================
INSERT INTO cards (card_id, name, flavour_text, image_url, category, rarity, stat_attack, stat_location, stat_influence, stat_legacy, stat_era, ability_name, ability_desc) VALUES
(1, 'Barney Barnato', 'A diamond magnate turned gold speculator.', 'https://example.com/cards/barnato.png', 'CHARACTER', 'RARE', 45, 20, 60, 100, 1886, 'Market Cornering', 'Boosts influence stat by 10 for one turn.'),
(2, 'Gold Reef City Mine Shaft', 'A relic of the original mining boom.', 'https://example.com/cards/mineshaft.png', 'LOCATION', 'COMMON', 10, 55, 15, 100, 1886, NULL, NULL);

-- ============================================================
--  7. EVENT CARD POOL
-- ============================================================
INSERT INTO event_card_pool (pool_id, event_id, card_id, weight, global_copy_limit, copies_awarded) VALUES
(1, 1, 1, 1, 50, 1),
(2, 1, 2, 3, NULL, 4);

-- ============================================================
--  8. USER CARDS
-- ============================================================
INSERT INTO user_cards (user_card_id, user_id, card_id, quantity) VALUES
(1, 1, 1, 1),
(2, 2, 2, 2);

-- ============================================================
--  9. EVENT CARD AWARDS
-- ============================================================
INSERT INTO event_card_awards (award_id, user_id, event_id, card_id) VALUES
(1, 1, 1, 1);

-- ============================================================
--  10. LOCATION CHECK LOG
-- ============================================================
INSERT INTO location_check_log (check_id, user_id, event_id, claimed_lat, claimed_lng, distance_meters, status, prev_check_id, travel_speed_ms) VALUES
(1, 1, 1, -26.20230000, 28.04360000, 4.20, 'VERIFIED', NULL, NULL),
(2, 2, 2, -26.19075000, 28.04125000, 6.80, 'VERIFIED', NULL, NULL);

-- ============================================================
--  11. TRIVIA ATTEMPTS
-- ============================================================
INSERT INTO trivia_attempts (attempt_id, user_id, event_id, question_id, location_check_id, is_correct, answer_time_ms, card_awarded_id, points_awarded, hint_used, attempt_number, cooldown_until) VALUES
(1, 1, 1, 1, 1, TRUE,  4200, 1, 20, FALSE, 1, '2026-01-02 00:00:00'),
(2, 2, 2, 2, 2, FALSE, 8900, NULL, 0, TRUE,  1, '2026-01-01 12:00:00');

-- ============================================================
--  12. USER DISCOVERED EVENTS
-- ============================================================
INSERT INTO user_discovered_events (user_id, event_id) VALUES
(1, 1),
(2, 2);

-- ============================================================
--  13. AUDIT LOG
-- ============================================================
INSERT INTO audit_log (log_id, actor_id, action, target_table, target_id, before_state, after_state) VALUES
(1, 1, 'CREATE', 'events', 1, NULL, JSON_OBJECT('title', 'Origins of Gold Reef City', 'is_active', TRUE)),
(2, 2, 'UPDATE', 'events', 2, JSON_OBJECT('point_reward', 10), JSON_OBJECT('point_reward', 15));

-- ============================================================
--  14. BATTLES
-- ============================================================
INSERT INTO battles (battle_id, player1_id, player2_id, winner_id, status, started_at, ended_at) VALUES
(1, 1, 2, 1, 'COMPLETED', '2026-01-05 10:00:00', '2026-01-05 10:15:00');

-- ============================================================
--  15. BATTLE DECKS
-- ============================================================
INSERT INTO battle_decks (deck_id, battle_id, user_id, card_id, slot_position) VALUES
(1, 1, 1, 1, 1),
(2, 1, 2, 2, 1);

-- ============================================================
--  16. BATTLE TURNS
-- ============================================================
INSERT INTO battle_turns (turn_id, battle_id, turn_number, acting_user_id, card_played_id, action, damage_dealt, effect_desc) VALUES
(1, 1, 1, 1, 1, 'ATTACK', 45, 'Barney Barnato strikes with Market Cornering.'),
(2, 1, 2, 2, 2, 'DEFEND', 0, 'Mine Shaft braces for impact.');

-- ============================================================
--  17. TRADES
-- ============================================================
INSERT INTO trades (trade_id, initiator_id, receiver_id, initiator_card_id, receiver_card_id, status, resolved_at) VALUES
(1, 1, 2, 1, 2, 'PENDING', NULL);

-- ============================================================
--  18. POINT TRANSACTIONS
-- ============================================================
INSERT INTO point_transactions (txn_id, user_id, delta, reason, reference_id) VALUES
(1, 1, 20, 'TRIVIA_WIN', 1),
(2, 2, -5, 'HINT_PURCHASE', 2);

-- ============================================================
--  19. COSMETICS
-- ============================================================
INSERT INTO cosmetics (cosmetic_id, name, description, type, point_cost, image_url) VALUES
(1, 'Golden Frame', 'A shimmering card frame themed after the gold rush.', 'CARD_FRAME', 100, 'https://example.com/cosmetics/golden_frame.png'),
(2, 'Fort Spotlight', 'A dramatic battle effect inspired by Constitution Hill.', 'BATTLE_EFFECT', 75, 'https://example.com/cosmetics/fort_spotlight.png');

-- ============================================================
--  20. USER COSMETICS
-- ============================================================
INSERT INTO user_cosmetics (user_id, cosmetic_id) VALUES
(1, 1),
(2, 2);

-- ============================================================
--  21. SEASONS
-- ============================================================
INSERT INTO seasons (season_id, name, starts_at, ends_at, is_active) VALUES
(1, 'Season 1: Founding Era', '2026-01-01 00:00:00', '2026-06-30 23:59:59', TRUE);

-- ============================================================
--  22. LEADERBOARD ENTRIES
-- ============================================================
INSERT INTO leaderboard_entries (entry_id, season_id, user_id, wins, losses, score) VALUES
(1, 1, 1, 3, 1, 320),
(2, 1, 2, 1, 3, 110);

-- USER CREDENTIALS (PIN: 1234 for both users)
INSERT INTO user_credentials (user_id, pin_hash) VALUES
(1, SHA2('1234', 256)),
(2, SHA2('1234', 256));

-- Seed test admin user (mirrors scripts/seed-admin.js)
-- email: admin@wits.ac.za | pin: 1234 (sha256 hashed)

INSERT IGNORE INTO users (provider_id, email, name)
VALUES ('local:admin@wits.ac.za', 'admin@wits.ac.za', 'Test Admin');

SET @admin_user_id = (SELECT user_id FROM users WHERE email = 'admin@wits.ac.za');

REPLACE INTO user_credentials (user_id, pin_hash)
VALUES (@admin_user_id, '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4');

INSERT IGNORE INTO admin_roles (user_id, role, granted_by)
VALUES (@admin_user_id, 'SUPER_ADMIN', @admin_user_id);
