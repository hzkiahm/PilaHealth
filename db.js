const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'Pilahealth_DB',
  password: '107163',
  port: 5432
});

module.exports = pool;