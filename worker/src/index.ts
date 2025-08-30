// worker/src/index.ts
import express = require('express');
import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';
import { videoCapture } from './video-capture';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const {
    POSTGRES_URL,
    WORKER_PORT,
    DVLA_API_KEY,
    APP_REGION = 'UK',
    ENABLE_INTERNATIONAL_API,
    ENABLE_VIDEO_CAPTURE
} = process.env;

if (!POSTGRES_URL || !WORKER_PORT) {
    console.error("FATAL: Missing POSTGRES_URL or WORKER_PORT in .env.local.");
    process.exit(1);
}
if (APP_REGION === 'UK' && !DVLA_API_KEY) {
    console.error("FATAL: APP_REGION is UK but DVLA_API_KEY is missing in .env.local.");
    process.exit(1);
}

const port = parseInt(WORKER_PORT, 10);
const pool = new Pool({ connectionString: POSTGRES_URL });

interface VehicleDetails {
    make: string;
    colour: string;
    fuelType: string;
    motStatus: string;
    taxStatus: string;
    motExpiryDate?: string;
    taxDueDate?: string;
    yearOfManufacture: number;
    monthOfFirstRegistration: string;
}

async function getVehicleDetailsFromDVLA(plateNumber: string): Promise<VehicleDetails | null> {
    const apiUrl = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
    const headers = { 'x-api-key': DVLA_API_KEY, 'Content-Type': 'application/json' };
    const data = { registrationNumber: plateNumber };

    try {
        const response = await axios.post<VehicleDetails>(apiUrl, data, { headers });
        console.log(`[${plateNumber}] DVLA Check SUCCESS: Vehicle found (${response.data.make}).`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            console.warn(`[${plateNumber}] DVLA Check FAILED: Status ${error.response.status}. Plate likely invalid or not found.`);
        } else {
            console.error(`[${plateNumber}] DVLA API request failed with an unexpected error:`, error);
        }
        return null;
    }
}

// Placeholder for a custom international API integration
async function getInternationalVehicleDetails(plateNumber: string): Promise<VehicleDetails | null> {
    console.log(`[${plateNumber}] International API lookup placeholder. To implement your own, edit this function in the worker.`);
    // TODO: Implement your country's vehicle API call here.
    // The returned object must match the VehicleDetails interface.
    // For now, it returns null.
    return null;
}

async function processPlateData(
    plateNumber: string,
    thumbnailBase64: string | undefined,
    details: VehicleDetails | null,
    videoUrl: string | null
) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const captureTime = new Date();
        const existingPlate = await client.query('SELECT id FROM license_plates WHERE plate_number = $1', [plateNumber]);

        if (existingPlate.rows.length > 0) {
            const plateId = existingPlate.rows[0].id;
            await client.query(
                `UPDATE license_plates SET 
                    recent_capture_time = $1, image_url = $2, video_url = $3, car_make = $4, car_color = $5,
                    fuel_type = $6, mot_status = $7, tax_status = $8, mot_expiry_date = $9, 
                    tax_due_date = $10, year_of_manufacture = $11, month_of_first_registration = $12, updated_at = NOW() 
                WHERE id = $13`,
                [captureTime, thumbnailBase64, videoUrl, details?.make, details?.colour, details?.fuelType, details?.motStatus, details?.taxStatus, details?.motExpiryDate, details?.taxDueDate, details?.yearOfManufacture, details?.monthOfFirstRegistration, plateId]
            );
            console.log(`[${plateNumber}] Updated record in database.`);
        } else {
            await client.query(
                `INSERT INTO license_plates (
                    plate_number, capture_time, recent_capture_time, image_url, video_url, 
                    car_make, car_color, fuel_type, mot_status, tax_status, 
                    mot_expiry_date, tax_due_date, year_of_manufacture, month_of_first_registration
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [plateNumber, captureTime, captureTime, thumbnailBase64, videoUrl, details?.make, details?.colour, details?.fuelType, details?.motStatus, details?.taxStatus, details?.motExpiryDate, details?.taxDueDate, details?.yearOfManufacture, details?.monthOfFirstRegistration]
            );
            console.log(`[${plateNumber}] Created new record in database.`);
        }

        await client.query('UPDATE app_state SET last_plate_update = NOW() WHERE id = 1');
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        if (error instanceof Error) { console.error(`[${plateNumber}] Database Transaction Error:`, error.message); }
    } finally {
        client.release();
    }
}

const app = express();
app.use(express.json({ limit: '10mb' }));

app.post('/webhook', async (req, res) => {
    res.status(200).send('Webhook received and acknowledged.');

    const payload = req.body;
    console.log(`\n--- LPR Webhook Received (Region: ${APP_REGION}) ---`);

    const plateNumber = payload?.alarm?.triggers?.[0]?.value;
    if (plateNumber) {
        const sanitizedPlate = plateNumber.toUpperCase().replace(/\s/g, '');
        const thumbnail = payload?.alarm?.thumbnail;
        console.log(`SUCCESS: Extracted Plate: ${sanitizedPlate}`);

        let proceedToSave = false;
        let vehicleDetails: VehicleDetails | null = null;

        if (APP_REGION === 'UK') {
            vehicleDetails = await getVehicleDetailsFromDVLA(sanitizedPlate);
            if (vehicleDetails) {
                proceedToSave = true;
            } else {
                console.log(`[${sanitizedPlate}] Plate rejected by DVLA validation. IGNORING ENTRY.`);
            }
        } else {
            proceedToSave = true;
            if (ENABLE_INTERNATIONAL_API === 'true') {
                vehicleDetails = await getInternationalVehicleDetails(sanitizedPlate);
            }
        }

        if (proceedToSave) {
            let videoUrl: string | null = null;
            if (ENABLE_VIDEO_CAPTURE === 'true') {
                videoUrl = await videoCapture.captureClip(sanitizedPlate);
            }
            await processPlateData(sanitizedPlate, thumbnail, vehicleDetails, videoUrl);
        }
    } else {
        console.warn("Webhook received, but no plate data was found.");
    }
});

app.listen(port, () => {
    console.log(`Worker listening for UniFi Protect LPR webhooks on port ${port}`);
    if (ENABLE_VIDEO_CAPTURE === 'true') {
        console.log('📹 On-demand video capture is enabled.');
    }
});