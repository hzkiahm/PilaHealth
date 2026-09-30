const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET appointment types
router.get('/types', (req, res) => {
  res.json(['Consultation', 'Follow-up', 'Check-up', 'Laboratory Request', 'Vaccination']);
});

// GET doctors list
router.get('/doctors', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT d.doctor_id, u.name, d.specialization
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      ORDER BY u.name
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/booking — book appointment
router.post('/', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'patient')
    return res.status(403).json({ error: 'Only patients can book' });

  const { doctor_id, appointment_type, date, time } = req.body;

  if (!doctor_id || !appointment_type || !date || !time)
    return res.status(400).json({ error: 'Please complete all required fields.' });

  try {
    const patient = await pool.query(
      'SELECT patient_id FROM patients WHERE user_id=$1',
      [req.session.user.user_id]
    );

    if (patient.rows.length === 0)
      return res.status(404).json({ error: 'Patient profile not found' });

    const patient_id = patient.rows[0].patient_id;

    // Duplicate check
    const dup = await pool.query(
      `SELECT 1 FROM appointments
       WHERE patient_id=$1 AND date=$2 AND time=$3
       AND status NOT IN ('Cancelled', 'No-show')`,
      [patient_id, date, time]
    );

    if (dup.rows.length > 0)
      return res.status(409).json({ error: 'You already have an appointment at this time.' });

    const ins = await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_type, date, time)
       VALUES ($1,$2,$3,$4,$5) RETURNING appointment_id`,
      [patient_id, doctor_id, appointment_type, date, time]
    );

    const appointment_id = ins.rows[0].appointment_id;

    // Trigger notification (event-driven)
    await pool.query(
      `INSERT INTO notifications (user_id, type, message, trigger_event, status)
       VALUES ($1, 'SMS/Email', $2, 'booking.confirmed', 'Sent')`,
      [req.session.user.user_id,
       `Your ${appointment_type} on ${date} at ${time} is CONFIRMED.`]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, status, details)
       VALUES ($1, 'BOOK_APPOINTMENT', 'Booking', 'Success', $2)`,
      [req.session.user.user_id, JSON.stringify({ appointment_id })]
    );

    res.json({ appointment_id, message: 'Booking confirmed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/booking/mine — my appointments
router.get('/mine', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

  try {
    const p = await pool.query(
      'SELECT patient_id FROM patients WHERE user_id=$1',
      [req.session.user.user_id]
    );

    if (p.rows.length === 0) return res.json([]);

    const r = await pool.query(`
      SELECT a.*, u.name AS doctor_name
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      WHERE a.patient_id = $1
      ORDER BY a.date DESC, a.time DESC
    `, [p.rows[0].patient_id]);

    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;