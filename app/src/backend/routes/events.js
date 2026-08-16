const express = require('express');
const router  = express.Router();
const db      = require('../db');

function requireAuth(req, res, next) {
  if (!req.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorised — please log in' });
  }
  next();
}

/**
 * Ensure the authenticated user holds at least one authoring role.
 */
function requireEventAuthor(req, res, next) {
  const allowedRoles = ['SUPER_ADMIN', 'EVENT_AUTHOR'];
  const placeholders = allowedRoles.map(() => '?').join(', ');

  const sql = `
    SELECT 1 FROM admin_roles
    WHERE user_id = ?
      AND role IN (${placeholders})
    LIMIT 1
  `;

  db.query(sql, [req.user.user_id, ...allowedRoles], (err, rows) => {
    if (err)  return res.status(500).json({ error: err.message });
    if (!rows.length) {
      return res.status(403).json({ error: 'Forbidden — event author role required' });
    }
    next();
  });
}


router.get('/', (req, res) => {
  const showAll = req.query.all === 'true' && req.session?.user?.user_id;

  const sql = showAll
    ? 'SELECT * FROM events ORDER BY created_at DESC'
    : `SELECT * FROM events
       WHERE is_active = TRUE
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at   IS NULL OR ends_at   >= NOW())
       ORDER BY created_at DESC`;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


router.get('/:id', (req, res) => {
  // FIX: was req.prams.id (typo) and WHERE id=? (wrong column name)
  db.query(
    'SELECT * FROM events WHERE event_id = ?',
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!results.length) return res.status(404).json({ error: 'Event not found' });
      res.json(results[0]);
    }
  );
});


router.post('/', requireAuth, requireEventAuthor, (req, res) => {
  const {
    title,
    description,
    latitude,
    longitude,
    radius_meters,
    point_threshold,
    point_reward,
    starts_at,
    ends_at,
    repeat_interval,
    attempt_cooldown_s,
    max_attempts_per_window,
  } = req.body;

  if (!title || latitude == null || longitude == null || !radius_meters) {
    return res.status(400).json({
      error: 'title, latitude, longitude and radius_meters are required',
    });
  }

  const sql = `
    INSERT INTO events (
      title, description,
      latitude, longitude, radius_meters,
      point_threshold, point_reward,
      starts_at, ends_at,
      repeat_interval, attempt_cooldown_s, max_attempts_per_window,
      is_active, author_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
  `;

  const values = [
    title,
    description          ?? null,
    latitude,
    longitude,
    radius_meters,
    point_threshold      ?? 0,
    point_reward         ?? 10,
    starts_at            ?? null,
    ends_at              ?? null,
    repeat_interval      ?? null,
    attempt_cooldown_s   ?? 86400,
    max_attempts_per_window ?? 1,
    req.user.user_id,           // author_id — always from session
  ];

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Event created', event_id: result.insertId });
  });
});


router.put('/:id', requireAuth, requireEventAuthor, (req, res) => {
  const {
    title,
    description,
    latitude,
    longitude,
    radius_meters,
    point_threshold,
    point_reward,
    starts_at,
    ends_at,                    // FIX: was 'duration' — old column name
    repeat_interval,            // FIX: was 'event_interval' — old column name
    attempt_cooldown_s,
    max_attempts_per_window,
    is_active,
  } = req.body;

  const sql = `
    UPDATE events
    SET
      title                   = ?,
      description             = ?,
      latitude                = ?,
      longitude               = ?,
      radius_meters           = ?,
      point_threshold         = ?,
      point_reward            = ?,
      starts_at               = ?,
      ends_at                 = ?,
      repeat_interval         = ?,
      attempt_cooldown_s      = ?,
      max_attempts_per_window = ?,
      is_active               = ?
    WHERE event_id = ?
  `;

  const values = [
    title,
    description             ?? null,
    latitude,
    longitude,
    radius_meters,
    point_threshold         ?? 0,
    point_reward            ?? 10,
    starts_at               ?? null,
    ends_at                 ?? null,
    repeat_interval         ?? null,
    attempt_cooldown_s      ?? 86400,
    max_attempts_per_window ?? 1,
    is_active               ?? true,
    req.params.id,
  ];

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ message: 'Event updated' });
  });
});


router.delete('/:id', requireAuth, requireEventAuthor, (req, res) => {
  db.query(
    'DELETE FROM events WHERE event_id = ?',
    [req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!result.affectedRows) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.json({ message: 'Event deleted' });
    }
  );
});

module.exports = router;