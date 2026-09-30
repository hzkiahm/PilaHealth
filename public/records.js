const express = require('express');
const pool = require('../db');
const router = express.Router();

/* ==========================================================================
   POST /api/records — Create Consultation Record
   ========================================================================== */
router.post('/', async (req, res) => {
  // Authorization Guard
  if (!req.session?.user || req.session.user.role !== 'doctor') {
    return res.status(403).json({ error: 'Access denied. Only doctors can create consultation records.' });
  }

  const { appointment_id, diagnosis, notes, prescription } = req.body;

  // Input Validation
  if (!appointment_id || !diagnosis || !String(diagnosis).trim()) {
    return res.status(400).json({ error: 'Appointment ID and diagnosis are required.' });
  }

  const client = await pool.connect();

  try {
    // 1. Get Doctor Profile ID
    const docRes = await client.query(
      'SELECT doctor_id FROM doctors WHERE user_id = $1',
      [req.session.user.user_id]
    );

    if (docRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Doctor profile not found.' });
    }
    const doctor_id = docRes.rows[0].doctor_id;

    // 2. Fetch Appointment Details
    const aptRes = await client.query(
      'SELECT appointment_id, patient_id FROM appointments WHERE appointment_id = $1',
      [appointment_id]
    );

    if (aptRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Appointment not found.' });
    }
    const { patient_id } = aptRes.rows[0];

    // 3. Check for Existing Consultation Record
    const existingRes = await client.query(
      'SELECT 1 FROM consultation_records WHERE appointment_id = $1',
      [appointment_id]
    );

    if (existingRes.rows.length > 0) {
      client.release();
      return res.status(409).json({ error: 'A consultation record already exists for this appointment.' });
    }

    // 4. Begin Transaction Block
    await client.query('BEGIN');

    // Clean optional fields
    const cleanDiagnosis = String(diagnosis).trim();
    const cleanNotes = notes && String(notes).trim() ? String(notes).trim() : null;
    const cleanPrescription = prescription && String(prescription).trim() ? String(prescription).trim() : null;

    // Insert Consultation Record
    const insRes = await client.query(
      `INSERT INTO consultation_records
       (patient_id, doctor_id, appointment_id, diagnosis, notes, prescription)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING record_id`,
      [patient_id, doctor_id, appointment_id, cleanDiagnosis, cleanNotes, cleanPrescription]
    );
    const record_id = insRes.rows[0].record_id;

    // Update Appointment Status
    await client.query(
      `UPDATE appointments SET status = 'Completed' WHERE appointment_id = $1`,
      [appointment_id]
    );

    // Update Queue Status
    await client.query(
      `UPDATE queue_entries SET status = 'Completed' WHERE appointment_id = $1`,
      [appointment_id]
    );

    // Get Patient User Account ID for Notifications
    const patientUserRes = await client.query(
      'SELECT user_id FROM patients WHERE patient_id = $1',
      [patient_id]
    );

    if (patientUserRes.rows.length > 0) {
      const patient_user_id = patientUserRes.rows[0].user_id;
      const notificationMsg = `Your consultation record is ready. Diagnosis: ${cleanDiagnosis}.`;

      await client.query(
        `INSERT INTO notifications (user_id, type, message, trigger_event, status)
         VALUES ($1, 'SMS/Email', $2, 'consultation.completed', 'Sent')`,
        [patient_user_id, notificationMsg]
      );
    }

    // Write Audit Log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, module, status, details)
       VALUES ($1, 'CREATE_RECORD', 'Records', 'Success', $2)`,
      [
        req.session.user.user_id,
        JSON.stringify({ record_id, appointment_id, patient_id })
      ]
    );

    // Commit Transaction
    await client.query('COMMIT');

    res.status(201).json({
      record_id,
      message: 'Consultation record created successfully.'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating consultation record:', err);
    res.status(500).json({ error: 'Internal server error while creating record.' });
  } finally {
    client.release();
  }
});

/* ==========================================================================
   GET /api/records/mine — Doctor's Consultation History
   ========================================================================== */
router.get('/mine', async (req, res) => {
  // Authorization Guard
  if (!req.session?.user || req.session.user.role !== 'doctor') {
    return res.status(403).json({ error: 'Access denied.' });
  }

  try {
    const docRes = await pool.query(
      'SELECT doctor_id FROM doctors WHERE user_id = $1',
      [req.session.user.user_id]
    );

    if (docRes.rows.length === 0) {
      return res.json([]);
    }

    const recordsRes = await pool.query(
      `SELECT 
         r.record_id,
         r.patient_id,
         r.appointment_id,
         r.diagnosis,
         r.notes,
         r.prescription,
         r.date_created,
         u.name AS patient_name
       FROM consultation_records r
       JOIN patients p ON r.patient_id = p.patient_id
       JOIN users u ON p.user_id = u.user_id
       WHERE r.doctor_id = $1
       ORDER BY r.date_created DESC`,
      [docRes.rows[0].doctor_id]
    );

    res.json(recordsRes.rows);

  } catch (err) {
    console.error('Error fetching doctor records:', err);
    res.status(500).json({ error: 'Internal server error while fetching records.' });
  }
});

module.exports = router;
