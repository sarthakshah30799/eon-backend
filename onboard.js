const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '1',
    database: 'maraekat',
  });

  const companyId = '11111111-1111-4111-b111-111111111111';
  const systemUserId = '00000000-0000-0000-0000-000000000000';
  const adminUserId = '22222222-2222-2222-2222-222222222222';
  const adminEmail = 'sarthak.kumar@example.com';
  const adminPassword = 'password123';

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // 1. Hash the admin password
    console.log(`Hashing password "${adminPassword}"...`);
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // 2. Onboard the default Company
    console.log('Onboarding company "Maraekat FX Pvt. Ltd."...');
    await client.query(`
      INSERT INTO "company" (
        "id", "name", "designation", "rbiName", "rbiPlace", 
        "address1", "address2", "address3", "pincode", 
        "city", "state", "country", "createdBy", "updatedBy"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name",
        "designation" = EXCLUDED."designation",
        "rbiName" = EXCLUDED."rbiName",
        "rbiPlace" = EXCLUDED."rbiPlace",
        "address1" = EXCLUDED."address1",
        "address2" = EXCLUDED."address2",
        "address3" = EXCLUDED."address3",
        "pincode" = EXCLUDED."pincode",
        "city" = EXCLUDED."city",
        "state" = EXCLUDED."state",
        "country" = EXCLUDED."country",
        "updatedAt" = NOW();
    `, [
      companyId,
      'Maraekat FX Pvt. Ltd.',
      'Regional Compliance Officer',
      'RBI Main Office',
      'Mumbai',
      '12 Business Tower',
      'Nariman Point',
      'Mumbai, Maharashtra',
      '400021',
      'Mumbai',
      'Maharashtra',
      'India',
      systemUserId,
      systemUserId
    ]);
    console.log('Company onboarded successfully.');

    // 3. Onboard the Admin User
    console.log(`Onboarding admin user "${adminEmail}"...`);
    
    // Clear out any user with the same email or code to prevent conflicts
    await client.query('DELETE FROM "users" WHERE "email" = $1 OR "userCode" = $2;', [adminEmail, 'ADM001']);

    await client.query(`
      INSERT INTO "users" (
        "id", "userCode", "password", "firstName", "lastName", 
        "email", "countryCode", "phoneNumber", "status", "isHo", 
        "createdBy", "updatedBy"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      );
    `, [
      adminUserId,
      'ADM001',
      hashedPassword,
      'Sarthak',
      'Kumar',
      adminEmail,
      'IN',
      '9876543210',
      'active',
      true,
      systemUserId,
      systemUserId
    ]);
    console.log('Admin user onboarded successfully.');
    console.log('\n--- Login Credentials ---');
    console.log(`Email:    ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('-------------------------\n');

  } catch (err) {
    console.error('Error during onboarding seed:', err);
  } finally {
    await client.end();
  }
}

main();
