const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

const addColumn = async () => {
    const client = await pool.connect();
    console.log('Connected to the database.');

    try {
        const query = `
      ALTER TABLE license_plates
      ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);
    `;

        await client.query(query);
        console.log('✅ Column "image_url" added to "license_plates" table or already exists.');

    } catch (error) {
        console.error('❌ Error adding column:', error);
        process.exit(1);
    } finally {
        await client.release();
        await pool.end();
        console.log('Database connection closed.');
    }
};

addColumn();