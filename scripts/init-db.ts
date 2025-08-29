// scripts/init-db.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import prompts from 'prompts';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function initializeDatabase() {
    const client = await pool.connect();
    console.log('🔗 Connected to the database.');

    try {
        await client.query('BEGIN');
        console.log('🚀 Starting database initialization...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS license_plates (
                id SERIAL PRIMARY KEY,
                plate_number VARCHAR(15) NOT NULL,
                capture_time TIMESTAMPTZ NOT NULL,
                recent_capture_time TIMESTAMPTZ NOT NULL,
                video_url VARCHAR(255),
                car_make VARCHAR(50),
                car_color VARCHAR(50),
                fuel_type VARCHAR(50),
                mot_status VARCHAR(50),
                tax_status VARCHAR(50),
                mot_expiry_date DATE,
                tax_due_date DATE,
                year_of_manufacture INT,
                month_of_first_registration VARCHAR(7),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('✅ Table "license_plates" is ready.');

        await client.query(`
            ALTER TABLE license_plates
            ADD COLUMN IF NOT EXISTS image_url TEXT;
        `);
        console.log('✅ Column "image_url" is ready.');

        await client.query(`
            ALTER TABLE license_plates
            ALTER COLUMN image_url TYPE TEXT;
        `);
        console.log('✅ Column "image_url" type is set to TEXT.');

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_plate_number ON license_plates(plate_number);
        `);
        console.log('✅ Index on "plate_number" is ready.');

        await client.query(`
            CREATE TABLE IF NOT EXISTS app_state (
                id INT PRIMARY KEY DEFAULT 1,
                last_plate_update TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        await client.query(`
            INSERT INTO app_state (id, last_plate_update)
            VALUES (1, NOW())
            ON CONFLICT (id) DO NOTHING;
        `);
        console.log('✅ Table "app_state" for live updates is ready.');

        console.log('\n🔐 Setting up admin authentication tables...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS approved_emails (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        console.log('✅ Table "approved_emails" is ready.');

        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        console.log('✅ Table "admin_users" is ready.');

        await client.query('COMMIT');
        console.log('🎉 Database schema setup complete!');

        const response = await prompts({
            type: 'confirm',
            name: 'addAdmin',
            message: 'Do you want to add or verify an approved admin email?',
            initial: true
        });

        if (response.addAdmin) {
            const emailResponse = await prompts({
                type: 'text',
                name: 'email',
                message: 'Enter the email address for the approved admin user:',
                validate: value => /^\S+@\S+\.\S+$/.test(value) ? true : `Please enter a valid email.`
            });

            if (emailResponse.email) {
                const existing = await client.query('SELECT 1 FROM approved_emails WHERE email = $1', [emailResponse.email]);
                if (existing.rowCount > 0) {
                    console.log(`\n📧 Email "${emailResponse.email}" is already in the approved list. No action taken.`);
                } else {
                    await client.query('INSERT INTO approved_emails (email) VALUES ($1)', [emailResponse.email]);
                    console.log(`\n✅ Successfully added "${emailResponse.email}" to the approved list.`);
                    console.log('This user can now sign up on the /admin/auth page.');
                }
            } else {
                console.log('\n⏩ Canceled. No email was added.');
            }
        } else {
            console.log('\n⏩ Skipping admin email setup.');
        }

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ An error occurred during setup, rolling back changes:', err);
        process.exit(1);
    } finally {
        await client.release();
        await pool.end();
        console.log('🔌 Database connection closed.');
    }
}

initializeDatabase();