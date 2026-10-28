const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// Load environment variables from local .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...vals] = trimmed.split('=');
    if (key && !process.env[key.trim()]) {
      process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  database: process.env.DB_NAME || 'cms_dev',
  user: process.env.DB_USER || 'cms_dev_user',
  password: process.env.DB_PASSWORD || 'dev_secret_password_2026',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+05:30', // Indian Standard Time
  dateStrings: true
});

/**
 * Execute parameterized query using pool
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<Array>}
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Execute work inside an isolated ACID database transaction
 * Automatically rolls back on error and commits on success
 * @param {Function} callback - async (connection) => Promise<any>
 * @returns {Promise<any>}
 */
async function withTransaction(callback) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Test connectivity
 */
async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    const [res] = await conn.query('SELECT DATABASE() as current_db, VERSION() as db_version');
    return { ok: true, currentDb: res[0].current_db, version: res[0].db_version };
  } finally {
    conn.release();
  }
}

module.exports = {
  pool,
  query,
  withTransaction,
  testConnection
};
