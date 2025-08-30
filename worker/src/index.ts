// worker/src/index.ts
import express = require('express');
import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';

// --- Configuration ---
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const {
    POSTGRES_URL,
    WORKER_PORT,
    DVLA_API_KEY,
    APP_REGION = 'UK', // Default to UK if not set
    ENABLE_INTERNATIONAL_API,
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

// DVLA API Logic
async function getVehicleDetailsFromDVLA(plateNumber: string): Promise<VehicleDetails | null> {
    const apiUrl = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
    const headers = {
        'x-api-key': DVLA_API_KEY,
        'Content-Type': 'application/json',
    };
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

// Database logic, now handles nullable details
async function processPlateData(
    plateNumber: string,
    thumbnailBase64: string | undefined,
    details: VehicleDetails | null // Accepts null
) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const captureTime = new Date();
        const existingPlate = await client.query('SELECT id FROM license_plates WHERE plate_number = $1', [plateNumber]);

        if (existingPlate.rows.length > 0) {
            const plateId = existingPlate.rows[0].id;
            if (details) {
                // Update with full vehicle details if available
                await client.query(
                    `UPDATE license_plates SET 
                        recent_capture_time = $1, image_url = $2, car_make = $3, car_color = $4, fuel_type = $5,
                        mot_status = $6, tax_status = $7, mot_expiry_date = $8, tax_due_date = $9, 
                        year_of_manufacture = $10, month_of_first_registration = $11, updated_at = NOW() 
                    WHERE id = $12`,
                    [captureTime, thumbnailBase64, details.make, details.colour, details.fuelType, details.motStatus, details.taxStatus, details.motExpiryDate || null, details.taxDueDate || null, details.yearOfManufacture, details.monthOfFirstRegistration || null, plateId]
                );
                console.log(`[${plateNumber}] Updated record in database with new details.`);
            } else {
                // Update only time and image if no details are available
                await client.query('UPDATE license_plates SET recent_capture_time = $1, image_url = $2, updated_at = NOW() WHERE id = $3', [captureTime, thumbnailBase64, plateId]);
                console.log(`[${plateNumber}] Updated record in database without new details.`);
            }
        } else {
            // Insert new record with details if available, otherwise with nulls
            await client.query(
                `INSERT INTO license_plates (
                    plate_number, capture_time, recent_capture_time, image_url, 
                    car_make, car_color, fuel_type, mot_status, tax_status, 
                    mot_expiry_date, tax_due_date, year_of_manufacture, month_of_first_registration
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                [plateNumber, captureTime, captureTime, thumbnailBase64, details?.make, details?.colour, details?.fuelType, details?.motStatus, details?.taxStatus, details?.motExpiryDate, details?.taxDueDate, details?.yearOfManufacture, details?.monthOfFirstRegistration]
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
    const payload = req.body;
    console.log(`\n--- LPR Webhook Received (Region: ${APP_REGION}) ---`);

    const plateNumber = payload?.alarm?.triggers?.[0]?.value;
    if (plateNumber) {
        const sanitizedPlate = plateNumber.toUpperCase().replace(/\s/g, '');
        const thumbnail = payload?.alarm?.thumbnail;
        console.log(`SUCCESS: Extracted Plate: ${sanitizedPlate}`);

        if (APP_REGION === 'UK') {
            // In UK mode, we use the DVLA API as a strict validator.
            const vehicleDetails = await getVehicleDetailsFromDVLA(sanitizedPlate);
            if (vehicleDetails) {
                // If details are found, the plate is valid. Proceed to save.
                console.log(`[${sanitizedPlate}] Plate is valid, proceeding to save details to database.`);
                await processPlateData(sanitizedPlate, thumbnail, vehicleDetails);
            } else {
                // If NO details are found, it's a false positive. Do NOTHING.
                console.log(`[${sanitizedPlate}] Plate rejected by DVLA validation. IGNORING ENTRY.`);
            }
        } else {
            // In INTERNATIONAL mode, we save the detection regardless of API success.
            let vehicleDetails: VehicleDetails | null = null;
            if (ENABLE_INTERNATIONAL_API === 'true') {
                vehicleDetails = await getInternationalVehicleDetails(sanitizedPlate);
            }
            console.log(`[${sanitizedPlate}] Saving detection for INTERNATIONAL region.`);
            await processPlateData(sanitizedPlate, thumbnail, vehicleDetails);
        }

    } else {
        console.warn("Webhook received, but no plate data was found.");
    }
    res.status(200).send('Webhook received and acknowledged.');
});

app.listen(port, () => {
    console.log(`Worker listening for UniFi Protect LPR webhooks on port ${port}`);
});