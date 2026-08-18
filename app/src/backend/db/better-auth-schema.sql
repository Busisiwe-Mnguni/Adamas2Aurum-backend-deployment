-- ============================================================
--  BETTER AUTH CORE TABLES
--  Created once on server boot (idempotent). These tables hold
--  auth accounts/sessions and coexist with the game's `users`
--  table (note: singular `user` vs plural `users` — no clash).
--  seed.sql does not touch these, so auth accounts persist across
--  restarts.
-- ============================================================

CREATE TABLE IF NOT EXISTS `user` (
    `id`            varchar(128)  NOT NULL,
    `name`          text          NOT NULL,
    `email`         varchar(255)  NOT NULL,
    `emailVerified` boolean       NOT NULL DEFAULT FALSE,
    `image`         text,
    `createdAt`     datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt`     datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `user_email_unique` (`email`)
);

CREATE TABLE IF NOT EXISTS `session` (
    `id`         varchar(128)  NOT NULL,
    `token`      varchar(255)  NOT NULL,
    `userId`     varchar(128)  NOT NULL,
    `expiresAt`  datetime      NOT NULL,
    `createdAt`  datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt`  datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `ipAddress`  varchar(255),
    `userAgent`  text,
    PRIMARY KEY (`id`),
    UNIQUE KEY `session_token_unique` (`token`),
    KEY `session_userId_index` (`userId`),
    CONSTRAINT `session_user_fk` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `account` (
    `id`                    varchar(128)  NOT NULL,
    `accountId`             text          NOT NULL,
    `providerId`            text          NOT NULL,
    `userId`                varchar(128)  NOT NULL,
    `accessToken`           text,
    `refreshToken`          text,
    `idToken`               text,
    `accessTokenExpiresAt`  datetime,
    `refreshTokenExpiresAt` datetime,
    `scope`                 text,
    `password`              text,
    `createdAt`             datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt`             datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `account_userId_index` (`userId`),
    UNIQUE KEY `account_provider_unique` (`providerId`(255), `accountId`(255)),
    CONSTRAINT `account_user_fk` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `verification` (
    `id`          varchar(128)  NOT NULL,
    `identifier`  text          NOT NULL,
    `value`        text          NOT NULL,
    `expiresAt`    datetime      NOT NULL,
    `createdAt`    datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt`    datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
);
