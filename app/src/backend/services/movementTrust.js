import pool from '../utils/db.js'
import { distance_meters } from '../utils/geo.js'

const WALKING_SPEED_THRESHOLD_MPS = 2.5

export async function analyzeMovement(user_id, currentLat, currentLng) {
  const [prevRows] = await pool.query(
    `SELECT check_id, claimed_lat, claimed_lng,
            TIMESTAMPDIFF(SECOND, checked_at, NOW()) AS elapsed_seconds
     FROM location_check_log
     WHERE user_id = ?
     ORDER BY checked_at DESC
     LIMIT 1`,
    [user_id]
  )

  if (!prevRows.length) {
    return { prevCheckId: null, travelSpeedMps: null, isSuspicious: false }
  }

  const prev = prevRows[0]
  const distance = distance_meters(
    parseFloat(prev.claimed_lat),
    parseFloat(prev.claimed_lng),
    currentLat,
    currentLng
  )

  // elapsed_seconds computed by MySQL itself (TIMESTAMPDIFF), avoiding any
  // JS Date/timezone parsing ambiguity between the app server and DB.
  const elapsed = prev.elapsed_seconds
  const speed = elapsed <= 0 ? Infinity : distance / elapsed

  return {
    prevCheckId: prev.check_id,
    travelSpeedMps: Number.isFinite(speed) ? Math.round(speed * 100) / 100 : 9999,
    isSuspicious: speed > WALKING_SPEED_THRESHOLD_MPS,
  }
}