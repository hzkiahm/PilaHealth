const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);

    if (result.rows.length === 0)
      return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, module, status)
         VALUES ($1, 'FAILED_LOGIN', 'Auth', 'Failed')`,
        [user.user_id]
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, status)
       VALUES ($1, 'LOGIN', 'Auth', 'Success')`,
      [user.user_id]
    );

    res.json({ user: req.session.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

module.exports = router;