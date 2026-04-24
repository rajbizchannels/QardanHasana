require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./database');

async function migrate() {
  const schemaPath = path.join(__dirname, '../../../database/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const client = await pool.connect();
  try {
    console.log('Running database migrations...');
    await client.query(sql);
    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
