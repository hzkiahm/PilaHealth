const express = require('express');
const pool = require('../db');
const router = express.Router();

// ============================================================
// POST /api/records
// Create a consultation record (doctor only)
// ============================================================
router.post('/', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'doctor')
    return res.status(403).json({ error: 'Only doctors can create records' });

  const { appointment_id, diagnosis, notes, prescription } = req.body;

  if (!appointment_id || !diagnosis)
    return res.status(400).json({ error: 'Appointment ID and diagnosis are required' });

  try {
    // Get doctor_id
    const doc = await pool.query(
      'SELECT doctor_id FROM doctors WHERE user_id=$1',
      [req.session.user.user_id]
    );

    if (doc.rows.length === 0)
      return res.status(404).json({ error: 'Doctor profile not found' });

    const doctor_id = doc.rows[0].doctor_id;

    // Get appointment details
    const apt = await pool.query(
      'SELECT * FROM appointments WHERE appointment_id=$1',
      [appointment_id]
    );

    if (apt.rows.length === 0)
      return res.status(404).json({ error: 'Appointment not found' });

    const patient_id = apt.rows[0].patient_id;

    // Check if record already exists
    const existing = await pool.query(
      'SELECT 1 FROM consultation_records WHERE appointment_id=$1',
      [appointment_id]
    );

    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'Record already exists for this appointment' });

    // Insert record
    const ins = await pool.query(
      `INSERT INTO consultation_records
       (patient_id, doctor_id, appointment_id, diagnosis, notes, prescription)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING record_id`,
      [patient_id, doctor_id, appointment_id, diagnosis, notes, prescription]
    );

    // Update appointment status to Completed
    await pool.query(
      `UPDATE appointments SET status='Completed' WHERE appointment_id=$1`,
      [appointment_id]
    );

    // Update queue entry to Completed
    await pool.query(
      `UPDATE queue_entries SET status='Completed' WHERE appointment_id=$1`,
      [appointment_id]
    );

    // Trigger notification (event: consultation.completed)
    const patientUser = await pool.query(
      'SELECT user_id FROM patients WHERE patient_id=$1',
      [patient_id]
    );

    if (patientUser.rows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, message, trigger_event, status)
         VALUES ($1, 'SMS/Email', $2, 'consultation.completed', 'Sent')`,
        [patientUser.rows[0].user_id,
         `Your consultation record is ready. Diagnosis: ${diagnosis}.`]
      );
    }

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, status, details)
       VALUES ($1, 'CREATE_RECORD', 'Records', 'Success', $2)`,
      [req.session.user.user_id, JSON.stringify({ record_id: ins.rows[0].record_id })]
    );

    res.json({ record_id: ins.rows[0].record_id, message: 'Record saved' });
  } catch (err) {
    console.error('Error in POST /api/records:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/records/mine
// Get the logged-in doctor's own consultation records
// ============================================================
router.get('/mine', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'doctor')
    return res.status(403).json({ error: 'Forbidden' });

  try {
    const doc = await pool.query(
      'SELECT doctor_id FROM doctors WHERE user_id=$1',
      [req.session.user.user_id]
    );

    if (doc.rows.length === 0) return res.json([]);

    const r = await pool.query(`
      SELECT r.*, u.name AS patient_name
      FROM consultation_records r
      JOIN patients p ON r.patient_id = p.patient_id
      JOIN users u ON p.user_id = u.user_id
      WHERE r.doctor_id = $1
      ORDER BY r.date_created DESC
    `, [doc.rows[0].doctor_id]);

    res.json(r.rows);
  } catch (err) {
    console.error('Error in GET /api/records/mine:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;