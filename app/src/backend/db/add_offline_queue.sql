-- ============================================================
-- OFFLINE TRIVIA QUEUE LOG
--
-- Stores queued trivia attempt submissions sent from client-side
-- storage (IndexedDB / LocalStorage) when the device reconnects.
-- Serves as an audit ledger for deferred verification processing.
-- ============================================================
CREATE TABLE IF NOT EXISTS offline_trivia_queue (
    queue_id            INT           AUTO_INCREMENT PRIMARY KEY,
    user_id             INT           NOT NULL,
    event_id            INT           NOT NULL,
    question_id         INT           NOT NULL,
    selected_option_id  INT           NOT NULL,
    claimed_lat         DECIMAL(10,8) NOT NULL,
    claimed_lng         DECIMAL(11,8) NOT NULL,
    client_timestamp    DATETIME      NOT NULL,
    status              ENUM('ACCEPTED', 'REJECTED_WINDOW_EXPIRED', 'REJECTED_GEOFENCE', 'REJECTED_WRONG_ANSWER', 'REJECTED_INVALID_OPTION', 'REJECTED_EVENT_NOT_FOUND', 'ERROR') NOT NULL DEFAULT 'ACCEPTED',
    processed_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_otq_user     FOREIGN KEY (user_id)     REFERENCES users (user_id),
    CONSTRAINT fk_otq_event    FOREIGN KEY (event_id)    REFERENCES events (event_id),
    CONSTRAINT fk_otq_question FOREIGN KEY (question_id) REFERENCES trivia_questions (question_id)
);