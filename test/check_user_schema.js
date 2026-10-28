const { query, pool } = require('../config/db');

async function check() {
  try {
    const adminCols = await query('DESCRIBE admin');
    console.log('admin columns:', adminCols.map(c => `${c.Field} (${c.Type})`));

    const userCols = await query('DESCRIBE users');
    console.log('users columns:', userCols.map(c => `${c.Field} (${c.Type})`));

    const userlogCols = await query('DESCRIBE userlog');
    console.log('userlog columns:', userlogCols.map(c => `${c.Field} (${c.Type})`));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

check();
