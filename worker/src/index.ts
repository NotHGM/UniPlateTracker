const { Pool } = require('pg');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const dotenv = require('dotenv');

// --- Configuration ---
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const {
    POSTGRES_URL,
    HOME_ASSISTANT_URL,
    LONG_LIVED_ACCESS_TOKEN,
    HOME_ASSISTANT_SENSOR_NAME,
    RTSP_URL,
    BACKGROUND_TASK_POLL_RATE
} = process.env;

if (!POSTGRES_URL || !HOME_ASSISTANT_URL || !LONG_LIVED_ACCESS_TOKEN || !HOME_ASSISTANT_SENSOR_NAME || !RTSP_URL) {
    console.error("FATAL: Missing required environment variables for the worker service.");
    process.exit(1);
}

const pollRate = parseInt(BACKGROUND_TASK_POLL_RATE || '10000', 10);
const pool = new Pool({ connectionString: POSTGRES_URL });

const CAPTURES_DIR = path.resolve(__dirname, '../../public/captures');
if (!fs.existsSync(CAPTURES_DIR)) {
    fs.mkdirSync(CAPTURES_DIR, { recursive: true });
}

// --- Core Functions ---

async function fetchLatestPlate(): Promise<string | null> {
    const url = `${HOME_ASSISTANT_URL}/api/states/${HOME_ASSISTANT_SENSOR_NAME}`;
    const headers = { 'Authorization': `Bearer ${LONG_LIVED_ACCESS_TOKEN}` };
    try {
        const response = await axios.get(url, { headers, timeout: 5000 });
        const plate = response.data?.state;
        if (plate && plate !== 'unknown' && plate !== 'none') {
            return plate.toUpperCase();
        }
    } catch (error) {
        // This is the safe way to handle unknown errors in TypeScript
        if (error instanceof Error) {
            console.error('Error fetching from Home Assistant:', error.message);
        } else {
            console.error('An unknown error occurred while fetching from Home Assistant.');
        }
    }
    return null;
}

function captureImage(licensePlate: string): Promise<string | null> {
    return new Promise((resolve) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${licensePlate}_${timestamp}.jpg`;
        const outputPath = path.join(CAPTURES_DIR, filename);

        console.log(`[${licensePlate}] Capturing image from stream...`);

        ffmpeg(RTSP_URL)
            .setFfmpegPath('ffmpeg')
            .outputOptions(['-vframes 1', '-q:v 2', '-f image2'])
            .save(outputPath)
            .on('end', () => {
                console.log(`[${licensePlate}] Image saved: ${filename}`);
                resolve(`/captures/${filename}`);
            })
            // Explicitly type the error parameter to satisfy strict TypeScript rules
            .on('error', (err: Error) => {
                console.error(`[${licensePlate}] FFMPEG Error: ${err.message}`);
                resolve(null);
            });
    });
}

async function processPlateData(plateNumber: string) {
    const client = await pool.connect();
    try {
        const imageUrl = await captureImage(plateNumber);

        const existingPlate = await client.query('SELECT id FROM license_plates WHERE plate_number = $1', [plateNumber]);
        const captureTime = new Date();

        if (existingPlate.rows.length > 0) {
            const plateId = existingPlate.rows[0].id;
            await client.query(
                'UPDATE license_plates SET recent_capture_time = $1, image_url = $2, updated_at = NOW() WHERE id = $3',
                [captureTime, imageUrl, plateId]
            );
            console.log(`[${plateNumber}] Updated existing record.`);
        } else {
            await client.query(
                `INSERT INTO license_plates (plate_number, capture_time, recent_capture_time, image_url)
                 VALUES ($1, $2, $3, $4)`,
                [plateNumber, captureTime, captureTime, imageUrl]
            );
            console.log(`[${plateNumber}] Created new record in database.`);
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error(`[${plateNumber}] Database Error:`, error.message);
        } else {
            console.error(`[${plateNumber}] An unknown database error occurred.`);
        }
    } finally {
        client.release();
    }
}

// --- Main Polling Loop ---
let lastProcessedPlate: string | null = null;
let lastProcessTime: number = 0;

async function mainLoop() {
    const currentPlate = await fetchLatestPlate();
    if (!currentPlate) return;

    const now = Date.now();
    const isNewPlate = currentPlate !== lastProcessedPlate;
    const isCooldownOver = (now - lastProcessTime) > 30000;

    if (isNewPlate || isCooldownOver) {
        console.log(`\n--- New Detection: ${currentPlate} ---`);
        await processPlateData(currentPlate);
        lastProcessedPlate = currentPlate;
        lastProcessTime = now;
    }
}

// --- Start the Service ---
console.log("Starting UniPlateTracker Worker Service...");
console.log("Polling Home Assistant every", pollRate / 1000, "seconds.");
setInterval(mainLoop, pollRate);