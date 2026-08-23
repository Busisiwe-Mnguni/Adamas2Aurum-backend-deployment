import express from 'express'

import pool from '../utils/db.js'

const router = express.Router()

router.use((req, res, next) => {
	console.log(
		`[Cards Router Log] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`
	)
	next()
})

//  MIDDLEWARE

function requireAuth(req, res, next) {
	if (!req.user?.user_id) {
		return res.status(401).json({ error: 'Unauthorised — please log in' })
	}
	next()
}

function requireCardAuthor(req, res, next) {
	const allowedRoles = ['SUPER_ADMIN', 'CARD_AUTHOR']
	const placeholders = allowedRoles.map(() => '?').join(', ')

	const sql = `
    SELECT 1 FROM admin_roles
    WHERE user_id = ?
      AND role IN (${placeholders})
    LIMIT 1
  `

	pool.query(sql, [req.user.user_id, ...allowedRoles], (err, rows) => {
		if (err) return res.status(500).json({ error: err.message })
		if (!rows.length) {
			return res.status(403).json({
				error: 'Forbidden — card author role required',
			})
		}
		next()
	})
}

// PLAYER ROUTES


//   GET /api/cards
//   List all cards — used by the admin console card picker and
//   any "card browser" view. No auth required (cards are public data).

router.get('/', async (req, res) => {
	try {
		const [rows] = await pool.query(
			`SELECT
        card_id, name, flavour_text, image_url,
        category, rarity,
        stat_attack, stat_location, stat_influence, stat_legacy, stat_era,
        ability_name, ability_desc,
        created_at
      FROM cards
      ORDER BY category, rarity, name`
		)
		res.json(rows)
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})


//   GET /api/cards/:id
//   Single card detail — used when rendering a card's full stats.
 
router.get('/:id', async (req, res) => {
	try {
		const [rows] = await pool.query(
			`SELECT
        card_id, name, flavour_text, image_url,
        category, rarity,
        stat_attack, stat_location, stat_influence, stat_legacy, stat_era,
        ability_name, ability_desc,
        created_at
      FROM cards
      WHERE card_id = ?`,
			[req.params.id]
		)
		if (!rows.length) {
			return res.status(404).json({ error: 'Card not found' })
		}
		res.json(rows[0])
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})


//   GET /api/cards/collection/mine
//   Returns every card the logged-in player owns, joined with full card data.
//   Includes quantity and when they first obtained the card.

router.get('/collection/mine', requireAuth, async (req, res) => {
	try {
		const [rows] = await pool.query(
			`SELECT
        uc.user_card_id,
        uc.quantity,
        uc.obtained_at,
        c.card_id, c.name, c.flavour_text, c.image_url,
        c.category, c.rarity,
        c.stat_attack, c.stat_location, c.stat_influence, c.stat_legacy, c.stat_era,
        c.ability_name, c.ability_desc
      FROM user_cards uc
      JOIN cards c ON c.card_id = uc.card_id
      WHERE uc.user_id = ?
      ORDER BY c.category, c.rarity, c.name`,
			[req.user.user_id]
		)
		res.json(rows)
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

//  AUTHOR ROUTES CARD_AUTHOR

    // POST /api/cards
    // Create a new card. All stat fields default to 0 / 100 if omitted,
    //  matching the schema defaults.

router.post('/', requireAuth, requireCardAuthor, async (req, res) => {
	const {
		name,
		flavour_text,
		image_url,
		category,
		rarity,
		stat_attack,
		stat_location,
		stat_influence,
		stat_legacy,
		stat_era,
		ability_name,
		ability_desc,
	} = req.body

	if (!name || !category || !rarity) {
		return res.status(400).json({
			error: 'name, category, and rarity are required',
		})
	}

	const valid_categories = ['CHARACTER', 'LOCATION', 'INFLUENCE', 'HISTORICAL']
	const valid_rarities   = ['COMMON', 'RARE', 'LEGENDARY']

	if (!valid_categories.includes(category)) {
		return res.status(400).json({
			error: `category must be one of: ${valid_categories.join(', ')}`,
		})
	}
	if (!valid_rarities.includes(rarity)) {
		return res.status(400).json({
			error: `rarity must be one of: ${valid_rarities.join(', ')}`,
		})
	}

	const sql = `
    INSERT INTO cards (
      name, flavour_text, image_url,
      category, rarity,
      stat_attack, stat_location, stat_influence, stat_legacy, stat_era,
      ability_name, ability_desc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `

	const values = [
		name,
		flavour_text  ?? null,
		image_url     ?? null,
		category,
		rarity,
		stat_attack   ?? 0,
		stat_location ?? 0,
		stat_influence ?? 0,
		stat_legacy   ?? 100,
		stat_era      ?? 0,
		ability_name  ?? null,
		ability_desc  ?? null,
	]

	try {
		const [result] = await pool.query(sql, values)
		res.status(201).json({ message: 'Card created', card_id: result.insertId })
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

//   PUT /api/cards/:id
//   Update every field on an existing card. All fields must be sent 
//   same pattern as events.js PUT.
router.put('/:id', requireAuth, requireCardAuthor, async (req, res) => {
	const {
		name,
		flavour_text,
		image_url,
		category,
		rarity,
		stat_attack,
		stat_location,
		stat_influence,
		stat_legacy,
		stat_era,
		ability_name,
		ability_desc,
	} = req.body

	if (!name || !category || !rarity) {
		return res.status(400).json({
			error: 'name, category, and rarity are required',
		})
	}

	const sql = `
    UPDATE cards
    SET
      name           = ?,
      flavour_text   = ?,
      image_url      = ?,
      category       = ?,
      rarity         = ?,
      stat_attack    = ?,
      stat_location  = ?,
      stat_influence = ?,
      stat_legacy    = ?,
      stat_era       = ?,
      ability_name   = ?,
      ability_desc   = ?
    WHERE card_id = ?
  `

	const values = [
		name,
		flavour_text   ?? null,
		image_url      ?? null,
		category,
		rarity,
		stat_attack    ?? 0,
		stat_location  ?? 0,
		stat_influence ?? 0,
		stat_legacy    ?? 100,
		stat_era       ?? 0,
		ability_name   ?? null,
		ability_desc   ?? null,
		req.params.id,
	]

	try {
		const [result] = await pool.query(sql, values)
		if (!result.affectedRows) {
			return res.status(404).json({ error: 'Card not found' })
		}
		res.json({ message: 'Card updated' })
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})


    //  DELETE /api/cards/:id
    // Hard delete. Will fail with a FK error if the card is still
    // referenced in event_card_pool or user_cards.
router.delete('/:id', requireAuth, requireCardAuthor, async (req, res) => {
	try {
		const [result] = await pool.query(
			'DELETE FROM cards WHERE card_id = ?',
			[req.params.id]
		)
		if (!result.affectedRows) {
			return res.status(404).json({ error: 'Card not found' })
		}
		res.json({ message: 'Card deleted' })
	} catch (err) {
		// Sviolations clearly so the author knows what to clean up first
		if (err.code === 'ER_ROW_IS_REFERENCED_2') {
			return res.status(409).json({
				error:
					'Cannot delete — card is still linked to an event pool or player collection. Remove those links first.',
			})
		}
		res.status(500).json({ error: err.message })
	}
})

export default router