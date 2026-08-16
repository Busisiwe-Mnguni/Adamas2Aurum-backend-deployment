CREATE TABLE users (
    user_id       INT            AUTO_INCREMENT PRIMARY KEY,
    provider_id   VARCHAR(255)   NOT NULL UNIQUE,
    email         VARCHAR(255)   NOT NULL UNIQUE,
    name          VARCHAR(100)   NOT NULL,
    avatar_url    VARCHAR(500),
    points        INT            NOT NULL DEFAULT 0,
    created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- ============================================================
--  2. [B] ADMIN ROLES  (authoring console access)
--
--  Separates who can author events, cards, and questions from
--  regular players. A user can hold multiple roles.
-- ============================================================
CREATE TABLE admin_roles (
    role_id     INT  AUTO_INCREMENT PRIMARY KEY,
    user_id     INT  NOT NULL,
    role        ENUM('SUPER_ADMIN','EVENT_AUTHOR','CARD_AUTHOR','MODERATOR') NOT NULL,
    granted_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by  INT,

    CONSTRAINT fk_ar_user      FOREIGN KEY (user_id)    REFERENCES users (user_id),
    CONSTRAINT fk_ar_grantor   FOREIGN KEY (granted_by) REFERENCES users (user_id),
    CONSTRAINT uq_ar           UNIQUE (user_id, role)
);


CREATE TABLE user_credentials (
    user_id   INT          PRIMARY KEY,
    pin_hash  VARCHAR(64)  NOT NULL,
    created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ucred_user FOREIGN KEY (user_id) REFERENCES users (user_id)
);



CREATE TABLE events (
    event_id          INT             AUTO_INCREMENT PRIMARY KEY,
    title             VARCHAR(255)    NOT NULL,
    description       TEXT,
    latitude          DECIMAL(10, 8)  NOT NULL,
    longitude         DECIMAL(11, 8)  NOT NULL,
    radius_meters     INT             NOT NULL DEFAULT 50,
    point_threshold   INT             NOT NULL DEFAULT 0,
    point_reward      INT             NOT NULL DEFAULT 10,
    starts_at         DATETIME,
    ends_at           DATETIME,
    repeat_interval   INT,                             -- seconds; NULL = one-shot
    -- [E] how long a player must wait before attempting the same event again
    attempt_cooldown_s INT            NOT NULL DEFAULT 86400,  -- default 24 h
    -- [E] max attempts allowed per player per cooldown window (0 = unlimited)
    max_attempts_per_window INT       NOT NULL DEFAULT 1,
    is_active         BOOLEAN         NOT NULL DEFAULT TRUE,
    author_id         INT             NOT NULL,
    created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_event_author FOREIGN KEY (author_id) REFERENCES users (user_id)
);


CREATE TABLE trivia_questions (
    question_id   INT          AUTO_INCREMENT PRIMARY KEY,
    event_id      INT          NOT NULL,
    format        ENUM('MULTIPLE_CHOICE','TRUE_FALSE','MULTIPLE_SELECT','FILL_BLANK') NOT NULL,
    body          TEXT         NOT NULL,
    time_limit_s  INT          NOT NULL DEFAULT 30,
    difficulty    TINYINT      NOT NULL DEFAULT 1,     -- 1=easy, 2=medium, 3=hard

    CONSTRAINT fk_question_event FOREIGN KEY (event_id) REFERENCES events (event_id)
);

CREATE TABLE trivia_options (
    option_id     INT      AUTO_INCREMENT PRIMARY KEY,
    question_id   INT      NOT NULL,
    body          TEXT     NOT NULL,
    is_correct    BOOLEAN  NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_option_question FOREIGN KEY (question_id) REFERENCES trivia_questions (question_id)
);


CREATE TABLE cards (
    card_id         INT          AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    flavour_text    TEXT,
    image_url       VARCHAR(500),
    category        ENUM('CHARACTER','LOCATION','INFLUENCE','HISTORICAL') NOT NULL,
    rarity          ENUM('COMMON','RARE','LEGENDARY')                     NOT NULL,
    stat_attack     INT          NOT NULL DEFAULT 0,
    stat_location   INT          NOT NULL DEFAULT 0,
    stat_influence  INT          NOT NULL DEFAULT 0,
    stat_legacy     INT          NOT NULL DEFAULT 100,
    stat_era        INT          NOT NULL DEFAULT 0,
    ability_name    VARCHAR(100),                      -- Sprint 2/3
    ability_desc    TEXT,                              -- Sprint 2/3
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
--  6. EVENT → CARD POOL
--
--  [F] global_copy_limit: total copies of this card that can
--      ever be awarded from this event across ALL players.
--      NULL = unlimited (Common). Enforces RARE/LEGENDARY scarcity.
-- ============================================================
CREATE TABLE event_card_pool (
    pool_id            INT  AUTO_INCREMENT PRIMARY KEY,
    event_id           INT  NOT NULL,
    card_id            INT  NOT NULL,
    weight             INT  NOT NULL DEFAULT 1,
    global_copy_limit  INT,                            -- NULL = no cap
    copies_awarded     INT  NOT NULL DEFAULT 0,        -- incremented on each award

    CONSTRAINT fk_pool_event FOREIGN KEY (event_id) REFERENCES events (event_id),
    CONSTRAINT fk_pool_card  FOREIGN KEY (card_id)  REFERENCES cards  (card_id),
    CONSTRAINT uq_pool       UNIQUE (event_id, card_id)
);

CREATE TABLE user_cards (
    user_card_id  INT      AUTO_INCREMENT PRIMARY KEY,
    user_id       INT      NOT NULL,
    card_id       INT      NOT NULL,
    quantity      INT      NOT NULL DEFAULT 1,
    obtained_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_uc_user FOREIGN KEY (user_id) REFERENCES users (user_id),
    CONSTRAINT fk_uc_card FOREIGN KEY (card_id) REFERENCES cards (card_id),
    CONSTRAINT uq_uc      UNIQUE (user_id, card_id)
);


-- ============================================================
--  8. [D] EVENT CARD AWARDS  — one card per event per user
--
--  The brief states a card tied to an event is awarded ONCE.
--  This table is the authoritative record of that award.
--  Before granting a card the server checks:
--    SELECT 1 FROM event_card_awards
--    WHERE user_id = ? AND event_id = ?
--  If a row exists, no card is awarded regardless of the
--  trivia result — the player still earns points for winning.
-- ============================================================
CREATE TABLE event_card_awards (
    award_id    INT      AUTO_INCREMENT PRIMARY KEY,
    user_id     INT      NOT NULL,
    event_id    INT      NOT NULL,
    card_id     INT      NOT NULL,
    awarded_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_eca_user  FOREIGN KEY (user_id)  REFERENCES users   (user_id),
    CONSTRAINT fk_eca_event FOREIGN KEY (event_id) REFERENCES events  (event_id),
    CONSTRAINT fk_eca_card  FOREIGN KEY (card_id)  REFERENCES cards   (card_id),
    -- Enforces the one-card-per-event-per-user rule at the DB level
    CONSTRAINT uq_eca       UNIQUE (user_id, event_id)
);


-- ============================================================
--  9. [A] LOCATION CHECK LOG  (server-side GPS verification)
--
--  The client sends its claimed coordinates. The server
--  independently validates them using:
--    - Haversine distance vs event radius
--    - Timestamp delta (reject stale pings)
--    - Velocity check (flag impossible travel between pings)
--  This log is the audit trail for every check.
--  status = SPOOFED triggers a moderation flag.
-- ============================================================
CREATE TABLE location_check_log (
    check_id          INT             AUTO_INCREMENT PRIMARY KEY,
    user_id           INT             NOT NULL,
    event_id          INT             NOT NULL,
    claimed_lat       DECIMAL(10, 8)  NOT NULL,   -- what the client sent
    claimed_lng       DECIMAL(11, 8)  NOT NULL,
    distance_meters   DECIMAL(10, 2)  NOT NULL,   -- server-calculated distance to event
    status            ENUM('PENDING','VERIFIED','FAILED','SPOOFED') NOT NULL DEFAULT 'PENDING',
    -- Velocity check: compare against the user's previous verified ping
    prev_check_id     INT,                         -- NULL = first check
    travel_speed_ms   DECIMAL(8, 2),               -- metres/second since last check; NULL if first
    checked_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_lcl_user      FOREIGN KEY (user_id)      REFERENCES users            (user_id),
    CONSTRAINT fk_lcl_event     FOREIGN KEY (event_id)     REFERENCES events           (event_id),
    CONSTRAINT fk_lcl_prev      FOREIGN KEY (prev_check_id) REFERENCES location_check_log (check_id)
);


-- ============================================================
--  10. TRIVIA ATTEMPT LOG
--
--  [E] attempt_number counts attempts within the current
--      cooldown window for this user+event pair.
--      cooldown_until tells the server when the player may
--      attempt again (set = attempted_at + attempt_cooldown_s).
-- ============================================================
CREATE TABLE trivia_attempts (
    attempt_id        INT      AUTO_INCREMENT PRIMARY KEY,
    user_id           INT      NOT NULL,
    event_id          INT      NOT NULL,
    question_id       INT      NOT NULL,
    location_check_id INT      NOT NULL,            -- [A] must have a VERIFIED check to play
    is_correct        BOOLEAN  NOT NULL,
    answer_time_ms    INT      NOT NULL,
    card_awarded_id   INT,                           -- NULL if wrong, or already awarded
    points_awarded    INT      NOT NULL DEFAULT 0,
    hint_used         BOOLEAN  NOT NULL DEFAULT FALSE,
    attempt_number    INT      NOT NULL DEFAULT 1,  -- [E] which attempt in this window
    cooldown_until    DATETIME,                     -- [E] NULL if no further cooldown applies
    attempted_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ta_user     FOREIGN KEY (user_id)           REFERENCES users              (user_id),
    CONSTRAINT fk_ta_event    FOREIGN KEY (event_id)          REFERENCES events             (event_id),
    CONSTRAINT fk_ta_question FOREIGN KEY (question_id)       REFERENCES trivia_questions   (question_id),
    CONSTRAINT fk_ta_loc      FOREIGN KEY (location_check_id) REFERENCES location_check_log (check_id),
    CONSTRAINT fk_ta_card     FOREIGN KEY (card_awarded_id)   REFERENCES cards              (card_id)
);


-- ============================================================
--  11. DISCOVERED LOCATIONS  (anti-exploit gate for trading)
-- ============================================================
CREATE TABLE user_discovered_events (
    user_id    INT      NOT NULL,
    event_id   INT      NOT NULL,
    first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, event_id),
    CONSTRAINT fk_ude_user  FOREIGN KEY (user_id)  REFERENCES users  (user_id),
    CONSTRAINT fk_ude_event FOREIGN KEY (event_id) REFERENCES events (event_id)
);


-- ============================================================
--  12. [C] AUDIT LOG  (authoring console trail)
--
--  Records every create/update/delete made through the admin
--  console so changes can be reviewed and rolled back.
-- ============================================================
CREATE TABLE audit_log (
    log_id        INT          AUTO_INCREMENT PRIMARY KEY,
    actor_id      INT          NOT NULL,             -- admin who made the change
    action        ENUM('CREATE','UPDATE','DELETE')   NOT NULL,
    target_table  VARCHAR(64)  NOT NULL,             -- e.g. 'events', 'cards', 'trivia_questions'
    target_id     INT          NOT NULL,             -- PK of the affected row
    before_state  JSON,                              -- snapshot before change; NULL on CREATE
    after_state   JSON,                              -- snapshot after change;  NULL on DELETE
    changed_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_al_actor FOREIGN KEY (actor_id) REFERENCES users (user_id)
);


-- ============================================================
--  13. BATTLES
-- ============================================================
CREATE TABLE battles (
    battle_id     INT      AUTO_INCREMENT PRIMARY KEY,
    player1_id    INT      NOT NULL,
    player2_id    INT,                               -- NULL = CPU
    winner_id     INT,
    status        ENUM('PENDING','ACTIVE','COMPLETED','ABANDONED') NOT NULL DEFAULT 'PENDING',
    started_at    DATETIME,
    ended_at      DATETIME,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_battle_p1     FOREIGN KEY (player1_id) REFERENCES users (user_id),
    CONSTRAINT fk_battle_p2     FOREIGN KEY (player2_id) REFERENCES users (user_id),
    CONSTRAINT fk_battle_winner FOREIGN KEY (winner_id)  REFERENCES users (user_id)
);

CREATE TABLE battle_decks (
    deck_id       INT     AUTO_INCREMENT PRIMARY KEY,
    battle_id     INT     NOT NULL,
    user_id       INT     NOT NULL,
    card_id       INT     NOT NULL,
    slot_position TINYINT NOT NULL,                  -- 1–5

    CONSTRAINT fk_bd_battle FOREIGN KEY (battle_id) REFERENCES battles (battle_id),
    CONSTRAINT fk_bd_user   FOREIGN KEY (user_id)   REFERENCES users   (user_id),
    CONSTRAINT fk_bd_card   FOREIGN KEY (card_id)   REFERENCES cards   (card_id),
    CONSTRAINT uq_bd_slot   UNIQUE (battle_id, user_id, slot_position)
);

CREATE TABLE battle_turns (
    turn_id        INT      AUTO_INCREMENT PRIMARY KEY,
    battle_id      INT      NOT NULL,
    turn_number    INT      NOT NULL,
    acting_user_id INT      NOT NULL,
    card_played_id INT      NOT NULL,
    action         ENUM('ATTACK','BUFF','DEBUFF','DEFEND','DODGE') NOT NULL,
    damage_dealt   INT      NOT NULL DEFAULT 0,
    effect_desc    TEXT,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_bt_battle FOREIGN KEY (battle_id)      REFERENCES battles (battle_id),
    CONSTRAINT fk_bt_user   FOREIGN KEY (acting_user_id) REFERENCES users   (user_id),
    CONSTRAINT fk_bt_card   FOREIGN KEY (card_played_id) REFERENCES cards   (card_id)
);


-- ============================================================
--  14. TRADING
-- ============================================================
CREATE TABLE trades (
    trade_id          INT      AUTO_INCREMENT PRIMARY KEY,
    initiator_id      INT      NOT NULL,
    receiver_id       INT      NOT NULL,
    initiator_card_id INT      NOT NULL,
    receiver_card_id  INT      NOT NULL,
    status            ENUM('PENDING','ACCEPTED','DECLINED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at       DATETIME,

    CONSTRAINT fk_trade_init FOREIGN KEY (initiator_id)      REFERENCES users (user_id),
    CONSTRAINT fk_trade_recv FOREIGN KEY (receiver_id)       REFERENCES users (user_id),
    CONSTRAINT fk_trade_ic   FOREIGN KEY (initiator_card_id) REFERENCES cards (card_id),
    CONSTRAINT fk_trade_rc   FOREIGN KEY (receiver_card_id)  REFERENCES cards (card_id)
);


-- ============================================================
--  15. POINT TRANSACTIONS
-- ============================================================
CREATE TABLE point_transactions (
    txn_id       INT      AUTO_INCREMENT PRIMARY KEY,
    user_id      INT      NOT NULL,
    delta        INT      NOT NULL,
    reason       ENUM(
                   'TRIVIA_WIN',
                   'COSMETIC_PURCHASE',
                   'HINT_PURCHASE',
                   'INTEL_PURCHASE',
                   'REROLL_PURCHASE',
                   'CARD_SOLD',
                   'SEASON_BONUS',
                   'OTHER'
                 ) NOT NULL,
    reference_id INT,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pt_user FOREIGN KEY (user_id) REFERENCES users (user_id)
);


-- ============================================================
--  16. COSMETICS
-- ============================================================
CREATE TABLE cosmetics (
    cosmetic_id  INT          AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    description  TEXT,
    type         ENUM('CARD_FRAME','BATTLE_EFFECT','AVATAR') NOT NULL,
    point_cost   INT          NOT NULL DEFAULT 0,
    image_url    VARCHAR(500)
);

CREATE TABLE user_cosmetics (
    user_id      INT      NOT NULL,
    cosmetic_id  INT      NOT NULL,
    obtained_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, cosmetic_id),
    CONSTRAINT fk_ucos_user FOREIGN KEY (user_id)     REFERENCES users     (user_id),
    CONSTRAINT fk_ucos_cos  FOREIGN KEY (cosmetic_id) REFERENCES cosmetics (cosmetic_id)
);


-- ============================================================
--  17. SEASONS & LEADERBOARD
-- ============================================================
CREATE TABLE seasons (
    season_id  INT          AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    starts_at  DATETIME     NOT NULL,
    ends_at    DATETIME     NOT NULL,
    is_active  BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE TABLE leaderboard_entries (
    entry_id   INT  AUTO_INCREMENT PRIMARY KEY,
    season_id  INT  NOT NULL,
    user_id    INT  NOT NULL,
    wins       INT  NOT NULL DEFAULT 0,
    losses     INT  NOT NULL DEFAULT 0,
    score      INT  NOT NULL DEFAULT 0,

    CONSTRAINT fk_lb_season FOREIGN KEY (season_id) REFERENCES seasons (season_id),
    CONSTRAINT fk_lb_user   FOREIGN KEY (user_id)   REFERENCES users   (user_id),
    CONSTRAINT uq_lb        UNIQUE (season_id, user_id)
);
