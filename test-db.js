const pool = require('./db');

(async () => {
  try {
    const r = await pool.query('SELECT user_id, name, email, role FROM users');
    console.log('✅ Database connected!');
    console.log(r.rows);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();