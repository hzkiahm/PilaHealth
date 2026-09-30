const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/notification/mine
router.get('/mine', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

  try {
    const r = await pool.query(
      'SELECT * FROM notifications WHERE user_id=$1 ORDER BY timestamp DESC',
      [req.session.user.user_id]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notification/all (admin only)
router.get('/all', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin')
    return res.status(403).json({ error: 'Forbidden' });

  try {
    const r = await pool.query(`
      SELECT n.*, u.name AS user_name
      FROM notifications n
      JOIN users u ON n.user_id = u.user_id
      ORDER BY n.timestamp DESC
      LIMIT 100
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;