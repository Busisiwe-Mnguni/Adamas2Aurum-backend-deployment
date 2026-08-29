SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS user_credentials;
DROP TABLE IF EXISTS admin_roles;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS trivia_questions;
DROP TABLE IF EXISTS trivia_options;
DROP TABLE IF EXISTS cards;
DROP TABLE IF EXISTS event_card_pool;
DROP TABLE IF EXISTS user_cards;
DROP TABLE IF EXISTS event_card_awards;
DROP TABLE IF EXISTS location_check_log;
DROP TABLE IF EXISTS trivia_attempts;
DROP TABLE IF EXISTS user_discovered_events;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS battles;
DROP TABLE IF EXISTS battle_decks;
DROP TABLE IF EXISTS battle_turns;
DROP TABLE IF EXISTS trades;
DROP TABLE IF EXISTS point_transactions;
DROP TABLE IF EXISTS cosmetics;
DROP TABLE IF EXISTS user_cosmetics;
DROP TABLE IF EXISTS seasons;
DROP TABLE IF EXISTS leaderboard_entries;

SET FOREIGN_KEY_CHECKS = 1;
