const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const db      = require('../db');

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

router.post('/login', (req, res) => {
  const { email, pin } = req.body;

  if (!email || !pin) {
    return res.status(400).json({ error: 'email and pin are required' });
  }

  const sql = `
    SELECT u.user_id, u.name, u.email, uc.pin_hash
    FROM users u
    JOIN user_credentials uc ON uc.user_id = u.user_id
    WHERE u.email = ?
  `;

  db.query(sql, [email], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    if (user.pin_hash !== hashPin(pin)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = { user_id: user.user_id, name: user.name, email: user.email };
    res.json({ message: 'Logged in', user: req.session.user });
  });
});

router.get('/me', (req, res) => {
  if (!req.session?.user?.user_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { user_id, name, email } = req.session.user;

  db.query(
    'SELECT role FROM admin_roles WHERE user_id = ?',
    [user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        user_id,
        name,
        email,
        roles: rows.map(r => r.role),
      });
    }
  );
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out' });
  });
});

module.exports = router;
