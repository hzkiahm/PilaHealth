const express = require('express');
const pool = require('../db');
const router = express.Router();

// ============================================================
// GET /api/audit — full audit log (admin only)
// ============================================================
router.get('/', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin')
    return res.status(403).json({ error: 'Forbidden' });

  try {
    const r = await pool.query(`
      SELECT a.*, u.name AS user_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.user_id
      ORDER BY a.timestamp DESC
      LIMIT 100
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/audit/stats — dashboard statistics (admin only)
// ============================================================
router.get('/stats', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin')
    return res.status(403).json({ error: 'Forbidden' });

  try {
    const apt = await pool.query(
      `SELECT COUNT(*) AS n FROM appointments WHERE date = CURRENT_DATE`
    );

    const queue = await pool.query(
      `SELECT COUNT(*) AS n FROM queue_entries WHERE status != 'Completed'`
    );

    const completed = await pool.query(
      `SELECT COUNT(*) AS n FROM consultation_records WHERE date_created::date = CURRENT_DATE`
    );

    const users = await pool.query(
      `SELECT COUNT(*) AS n FROM users`
    );

    res.json({
      appointments_today: parseInt(apt.rows[0].n),
      in_queue: parseInt(queue.rows[0].n),
      completed_today: parseInt(completed.rows[0].n),
      total_users: parseInt(users.rows[0].n)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/audit/users — list all users (admin only)
// ============================================================
router.get('/users', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin')
    return res.status(403).json({ error: 'Forbidden' });

  try {
    const r = await pool.query(
      `SELECT user_id, name, email, role, status FROM users ORDER BY user_id`
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;