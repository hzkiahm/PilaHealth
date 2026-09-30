const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET current queue
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT q.queue_id, q.queue_number, q.status, q.check_in_time,
             u.name AS patient_name
      FROM queue_entries q
      JOIN patients p ON q.patient_id = p.patient_id
      JOIN users u ON p.user_id = u.user_id
      WHERE q.status != 'Completed'
      ORDER BY q.queue_number
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/queue/check-in — workflow automation
router.post('/check-in', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

  const { appointment_id } = req.body;
  if (!appointment_id)
    return res.status(400).json({ error: 'Appointment ID is required' });

  try {
    const apt = await pool.query(
      'SELECT * FROM appointments WHERE appointment_id=$1',
      [appointment_id]
    );

    if (apt.rows.length === 0)
      return res.status(404).json({ error: 'No appointment found.' });

    const existing = await pool.query(
      'SELECT 1 FROM queue_entries WHERE appointment_id=$1',
      [appointment_id]
    );

    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'You are already checked in.' });

    const last = await pool.query(
      'SELECT COALESCE(MAX(queue_number), 0) AS n FROM queue_entries'
    );
    const queue_number = last.rows[0].n + 1;

    const ins = await pool.query(
      `INSERT INTO queue_entries (patient_id, appointment_id, queue_number, status, check_in_time)
       VALUES ($1, $2, $3, 'Waiting', NOW())
       RETURNING queue_id`,
      [apt.rows[0].patient_id, appointment_id, queue_number]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, status, details)
       VALUES ($1, 'CHECK_IN', 'Queue', 'Success', $2)`,
      [req.session.user.user_id, JSON.stringify({ queue_number })]
    );

    res.json({
      queue_id: ins.rows[0].queue_id,
      queue_number,
      status: 'Waiting'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/queue/call-next — webhook simulation
router.post('/call-next', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'staff')
    return res.status(403).json({ error: 'Only staff can call patients' });

  try {
    const next = await pool.query(`
      SELECT q.*, p.user_id
      FROM queue_entries q
      JOIN patients p ON q.patient_id = p.patient_id
      WHERE q.status = 'Waiting'
      ORDER BY q.queue_number
      LIMIT 1
    `);

    if (next.rows.length === 0)
      return res.status(404).json({ error: 'No patients waiting' });

    const entry = next.rows[0];

    await pool.query(
      `UPDATE queue_entries SET status='Called', called_time=NOW()
       WHERE queue_id=$1`,
      [entry.queue_id]
    );

    // Webhook simulation: emit queue.called event
    await pool.query(
      `INSERT INTO notifications (user_id, type, message, trigger_event, status)
       VALUES ($1, 'SMS/Email', $2, 'queue.called', 'Sent')`,
      [entry.user_id,
       `It's your turn! Queue #${entry.queue_number}. Please proceed.`]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, status, details)
       VALUES ($1, 'CALL_NEXT', 'Queue', 'Success', $2)`,
      [req.session.user.user_id, JSON.stringify({ queue_number: entry.queue_number })]
    );

    res.json({ called: entry.queue_number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;