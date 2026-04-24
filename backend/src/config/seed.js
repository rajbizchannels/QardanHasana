require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./database');

async function seed() {
  const seedPath = path.join(__dirname, '../../../database/seed.sql');
  const sql = fs.readFileSync(seedPath, 'utf8');
  const client = await pool.connect();
  try {
    console.log('Running seed data...');
    await client.query(sql);
    console.log('Seed completed successfully.');
    console.log('\nDemo Credentials:');
    console.log('Admin:      ITS: 10000001  Password: Password@123');
    console.log('Accountant: ITS: 10000002  Password: Password@123');
    console.log('Creditor:   ITS: 10000003  Password: Password@123');
    console.log('Debtor:     ITS: 10000004  Password: Password@123');
  } catch (err) {
    console.error('Seed error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
