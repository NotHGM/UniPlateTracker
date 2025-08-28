import express = require('express');
const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// --- Configuration ---
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const {
    POSTGRES_URL,
    WORKER_PORT
} = process.env;

if (!POSTGRES_URL || !WORKER_PORT) {
    console.error("FATAL: Missing POSTGRES_URL or WORKER_PORT in .env.local.");
    process.exit(1);
}

const port = parseInt(WORKER_PORT, 10);
const pool = new Pool({ connectionString: POSTGRES_URL });

// --- Database Logic ---
async function processPlateData(plateNumber: string, thumbnailBase64: string | undefined) {
    const client = await pool.connect();
    try {
        const captureTime = new Date();
        const existingPlate = await client.query('SELECT id FROM license_plates WHERE plate_number = $1', [plateNumber]);

        if (existingPlate.rows.length > 0) {
            const plateId = existingPlate.rows[0].id;
            // Update the record with the new time and the raw base64 thumbnail string.
            await client.query('UPDATE license_plates SET recent_capture_time = $1, image_url = $2, updated_at = NOW() WHERE id = $3', [captureTime, thumbnailBase64, plateId]);
            console.log(`[${plateNumber}] Updated record in database with new thumbnail.`);
        } else {
            // Create a new record, storing the raw base64 thumbnail string.
            await client.query(`INSERT INTO license_plates (plate_number, capture_time, recent_capture_time, image_url) VALUES ($1, $2, $3, $4)`, [plateNumber, captureTime, captureTime, thumbnailBase64]);
            console.log(`[${plateNumber}] Created new record in database with thumbnail.`);
        }
    } catch (error) {
        if (error instanceof Error) { console.error(`[${plateNumber}] Database Error:`, error.message); }
    } finally {
        client.release();
    }
}

// --- Webhook Server ---
const app = express();
app.use(express.json({ limit: '10mb' }));

app.post('/webhook', (req: express.Request, res: express.Response) => {
    const payload = req.body;
    console.log(`\n--- LPR Webhook Received ---`);

    const trigger = payload?.alarm?.triggers?.[0];
    const thumbnail = payload?.alarm?.thumbnail; // The full "data:image/jpeg;base64,..." string
    const plateNumber = trigger?.value;

    if (plateNumber) {
        const sanitizedPlate = plateNumber.toUpperCase().replace(/\s/g, '');
        console.log(`SUCCESS: Extracted Plate: ${sanitizedPlate}`);
        // Pass the raw base64 string directly to the processing function.
        processPlateData(sanitizedPlate, thumbnail);
    } else {
        console.warn("Webhook received, but no plate data was not found.");
    }
    res.status(200).send('Webhook received and acknowledged.');
});

app.listen(port, () => {
    console.log(`Worker listening for UniFi Protect LPR webhooks on port ${port}`);
});