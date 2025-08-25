import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { z } from 'zod';

// Define a schema to validate and sanitize incoming query parameters.
// This is a critical security measure to prevent invalid data and attacks.
const QuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10), // Max 100 to prevent abuse
    make: z.string().optional(),
    color: z.string().optional(),
    year: z.coerce.number().int().optional(),
    fuelType: z.string().optional(),
    tax: z.string().optional(),
    mot: z.string().optional(),
});

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    // 1. VALIDATE & PARSE INPUT
    // We use our Zod schema to safely parse the query string.
    const validation = QuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!validation.success) {
        // If validation fails, return a clear error response.
        return NextResponse.json(
            { error: 'Invalid query parameters', details: validation.error.flatten() },
            { status: 400 } // 400 Bad Request
        );
    }

    const { page, limit, make, color, year, fuelType, tax, mot } = validation.data;
    const offset = (page - 1) * limit;

    // 2. SECURELY BUILD THE DATABASE QUERY
    // We build the query dynamically but use parameterized values ($1, $2, etc.)
    // to completely prevent SQL injection.
    const conditions: string[] = [];
    const queryParams: (string | number)[] = [];

    const addCondition = (field: string, value: any) => {
        if (value) {
            queryParams.push(value);
            conditions.push(`${field} = $${queryParams.length}`);
        }
    };

    addCondition('car_make', make);
    addCondition('car_color', color);
    addCondition('year_of_manufacture', year);
    addCondition('fuel_type', fuelType);
    addCondition('tax_status', tax);
    addCondition('mot_status', mot);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 3. EXECUTE THE QUERY
    const client = await pool.connect();
    try {
        // Query to get the actual data for the current page
        const dataQuery = `
      SELECT * FROM license_plates
      ${whereClause}
      ORDER BY recent_capture_time DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
        const dataResult = await client.query(dataQuery, [...queryParams, limit, offset]);

        // A second query to get the total number of records that match the filter
        // This is essential for calculating the total number of pages for pagination
        const countQuery = `SELECT COUNT(*) FROM license_plates ${whereClause}`;
        const countResult = await client.query(countQuery, queryParams);

        const totalRows = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalRows / limit);

        // 4. RETURN THE RESPONSE
        return NextResponse.json({
            data: dataResult.rows,
            pagination: {
                currentPage: page,
                totalPages,
                totalRows,
            },
        });

    } catch (error) {
        console.error('API Error fetching plates:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        // This is critical: always release the client back to the pool
        client.release();
    }
}