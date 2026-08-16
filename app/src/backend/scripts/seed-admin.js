/**
 * Seeds a test admin user into the database.
 * Run: node scripts/seed-admin.js
 */
const crypto = require('crypto');
require('dotenv').config();
const db = require('../db');

const ADMIN_EMAIL = 'admin@wits.ac.za';
const ADMIN_NAME  = 'Test Admin';
const ADMIN_PIN   = '1234';

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function seed() {
  const providerId = `local:${ADMIN_EMAIL}`;

  db.query(
    'SELECT user_id FROM users WHERE email = ?',
    [ADMIN_EMAIL],
    (err, rows) => {
      if (err) { console.error(err); process.exit(1); }

      if (rows.length) {
        const userId = rows[0].user_id;
        console.log(`Admin user already exists (id=${userId}). Ensuring credentials + role…`);

        db.query(
          'REPLACE INTO user_credentials (user_id, pin_hash) VALUES (?, ?)',
          [userId, hashPin(ADMIN_PIN)],
          (err2) => {
            if (err2) { console.error(err2); process.exit(1); }

            db.query(
              'INSERT IGNORE INTO admin_roles (user_id, role, granted_by) VALUES (?, ?, ?)',
              [userId, 'SUPER_ADMIN', userId],
              (err3) => {
                if (err3) { console.error(err3); process.exit(1); }
                console.log(`Admin ready — email: ${ADMIN_EMAIL}, pin: ${ADMIN_PIN}`);
                process.exit(0);
              }
            );
          }
        );
        return;
      }

      db.query(
        'INSERT INTO users (provider_id, email, name) VALUES (?, ?, ?)',
        [providerId, ADMIN_EMAIL, ADMIN_NAME],
        (err2, result) => {
          if (err2) { console.error(err2); process.exit(1); }
          const userId = result.insertId;

          db.query(
            'INSERT INTO user_credentials (user_id, pin_hash) VALUES (?, ?)',
            [userId, hashPin(ADMIN_PIN)],
            (err3) => {
              if (err3) { console.error(err3); process.exit(1); }

              db.query(
                'INSERT INTO admin_roles (user_id, role, granted_by) VALUES (?, ?, ?)',
                [userId, 'SUPER_ADMIN', userId],
                (err4) => {
                  if (err4) { console.error(err4); process.exit(1); }
                  console.log(`Admin created — email: ${ADMIN_EMAIL}, pin: ${ADMIN_PIN}`);
                  process.exit(0);
                }
              );
            }
          );
        }
      );
    }
  );
}

seed();
