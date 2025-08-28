const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

const alterTable = async () => {
    const client = await pool.connect();
    console.log('Connected to the database.');

    try {
        // Change the column type from VARCHAR to TEXT to accommodate long base64 strings.
        const query = `
      ALTER TABLE license_plates
      ALTER COLUMN image_url TYPE TEXT;
    `;

        await client.query(query);
        console.log('✅ Column "image_url" in "license_plates" table has been changed to TEXT type.');

    } catch (error) {
        console.error('❌ Error altering table:', error);
        process.exit(1);
    } finally {
        await client.release();
        await pool.end();
        console.log('Database connection closed.');
    }
};

alterTable();