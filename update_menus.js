require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const sslConfig = process.env.DB_SSL === 'true' ? {
  rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
} : false;

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: sslConfig,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Enable uuid-ossp extension
    console.log('Ensuring uuid-ossp extension exists...');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // Clean up existing menus (we truncate with CASCADE to handle foreign key dependencies)
    console.log('Clearing existing menus and dependent roles menu permissions...');
    await client.query('TRUNCATE TABLE "menus" CASCADE;');

    // Read seed-menus.sql file
    const sqlPath = path.join(__dirname, 'src', 'database', 'seed-menus.sql');
    console.log(`Reading SQL script from ${sqlPath}...`);
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Run the SQL script
    console.log('Executing seed-menus.sql queries...');
    await client.query(sqlContent);
    console.log('Menus seeded successfully from SQL file.');

  } catch (err) {
    console.error('Error during menu update:', err);
  } finally {
    await client.end();
  }
}

main();
