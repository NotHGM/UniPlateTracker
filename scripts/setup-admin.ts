// scripts/setup-admin.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import prompts from 'prompts';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function setupDatabase() {
    const client = await pool.connect();
    try {
        console.log('Connecting to the database...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS approved_emails (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        console.log('✅ "approved_emails" table created or already exists.');

        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        console.log('✅ "admin_users" table created or already exists.');

        const response = await prompts({
            type: 'text',
            name: 'email',
            message: 'Enter the email address for the first approved admin user:',
            validate: value => /^\S+@\S+\.\S+$/.test(value) ? true : `Please enter a valid email address.`
        });

        if (response.email) {
            const existing = await client.query('SELECT 1 FROM approved_emails WHERE email = $1', [response.email]);
            if (existing.rowCount > 0) {
                console.log(`\nEmail "${response.email}" is already in the approved list. No action taken.`);
            } else {
                await client.query('INSERT INTO approved_emails (email) VALUES ($1)', [response.email]);
                console.log(`\n✅ Successfully added "${response.email}" to the approved list.`);
                console.log('This user can now sign up on the /admin/auth page.');
            }
        } else {
            console.log('\nSetup cancelled. No email was added.');
        }

    } catch (err) {
        console.error('\n❌ An error occurred during setup:', err);
    } finally {
        await client.release();
        await pool.end();
        console.log('Database connection closed.');
    }
}

setupDatabase();