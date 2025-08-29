// worker/src/index.ts
import express = require('express');
import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const {
    POSTGRES_URL,
    WORKER_PORT,
    DVLA_API_KEY
} = process.env;

if (!POSTGRES_URL || !WORKER_PORT || !DVLA_API_KEY) {
    console.error("FATAL: Missing POSTGRES_URL, WORKER_PORT, or DVLA_API_KEY in .env.local.");
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
    const headers = {
        'x-api-key': DVLA_API_KEY,
        'Content-Type': 'application/json',
    };
    const data = {
        registrationNumber: plateNumber,
    };

    try {
        const response = await axios.post<VehicleDetails>(apiUrl, data, { headers });
        console.log(`[${plateNumber}] DVLA Check SUCCESS: Vehicle found (${response.data.make}).`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const statusCode = error.response?.status;
            console.warn(`[${plateNumber}] DVLA Check FAILED: Status ${statusCode}. Plate is likely invalid.`);
        } else {
            console.error(`[${plateNumber}] DVLA API request failed with an unexpected error:`, error);
        }
        return null;
    }
}

async function processPlateData(
    plateNumber: string,
    thumbnailBase64: string | undefined,
    details: VehicleDetails
) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const captureTime = new Date();
        const existingPlate = await client.query('SELECT id FROM license_plates WHERE plate_number = $1', [plateNumber]);

        const vehicleData = [
            details.make,
            details.colour,
            details.fuelType,
            details.motStatus,
            details.taxStatus,
            details.motExpiryDate || null,
            details.taxDueDate || null,
            details.yearOfManufacture,
            details.monthOfFirstRegistration || null
        ];

        if (existingPlate.rows.length > 0) {
            const plateId = existingPlate.rows[0].id;
            await client.query(
                `UPDATE license_plates SET
                                           recent_capture_time = $1, image_url = $2, car_make = $3, car_color = $4, fuel_type = $5,
                                           mot_status = $6, tax_status = $7, mot_expiry_date = $8, tax_due_date = $9,
                                           year_of_manufacture = $10, month_of_first_registration = $11, updated_at = NOW()
                 WHERE id = $12`,
                [captureTime, thumbnailBase64, ...vehicleData, plateId]
            );
            console.log(`[${plateNumber}] Updated record in database with new details.`);
        } else {
            await client.query(
                `INSERT INTO license_plates (
                    plate_number, capture_time, recent_capture_time, image_url,
                    car_make, car_color, fuel_type, mot_status, tax_status,
                    mot_expiry_date, tax_due_date, year_of_manufacture, month_of_first_registration
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                [plateNumber, captureTime, captureTime, thumbnailBase64, ...vehicleData]
            );
            console.log(`[${plateNumber}] Created new record in database with details.`);
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

app.post('/webhook', async (req: express.Request, res: express.Response) => {
    const payload = req.body;
    console.log(`\n--- LPR Webhook Received ---`);

    const trigger = payload?.alarm?.triggers?.[0];
    const thumbnail = payload?.alarm?.thumbnail;
    const plateNumber = trigger?.value;

    if (plateNumber) {
        const sanitizedPlate = plateNumber.toUpperCase().replace(/\s/g, '');
        console.log(`SUCCESS: Extracted Plate: ${sanitizedPlate}`);

        const vehicleDetails = await getVehicleDetailsFromDVLA(sanitizedPlate);

        if (vehicleDetails) {
            console.log(`[${sanitizedPlate}] Plate is valid, proceeding to save details to database.`);
            processPlateData(sanitizedPlate, thumbnail, vehicleDetails);
        } else {
            console.log(`[${sanitizedPlate}] Plate rejected by DVLA check. Ignoring entry.`);
        }
    } else {
        console.warn("Webhook received, but no plate data was not found.");
    }
    res.status(200).send('Webhook received and acknowledged.');
});

app.listen(port, () => {
    console.log(`Worker listening for UniFi Protect LPR webhooks on port ${port}`);
});