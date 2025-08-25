const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from our .env.local file
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// A separate, direct pool for the script to ensure it runs independently
const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

const createTables = async () => {
    const client = await pool.connect();
    console.log('Connected to the database.');

    try {
        console.log('Starting table creation...');

        // This SQL command is unchanged
        const createTableQuery = `
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
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
                );
        `;

        await client.query(createTableQuery);
        console.log('✅ Table "license_plates" created or already exists.');

        // This SQL command is unchanged
        const createIndexQuery = `
            CREATE INDEX IF NOT EXISTS idx_plate_number ON license_plates(plate_number);
        `;
        await client.query(createIndexQuery);
        console.log('✅ Index on "plate_number" created or already exists.');

        console.log('Database schema setup complete.');

    } catch (error) {
        console.error('❌ Error setting up database schema:', error);
        process.exit(1);
    } finally {
        await client.release();
        await pool.end();
        console.log('Database connection closed.');
    }
};

// Execute the function
createTables();