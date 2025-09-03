// src/app/api/plates/route.ts
import { NextResponse, NextRequest } from 'next/server';
import pool from '@/lib/db';
import { z } from 'zod';

const QuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().optional(),
    make: z.string().optional(),
    color: z.string().optional(),
    year: z.coerce.number().int().optional(),
    tax: z.string().optional(),
    mot: z.string().optional(),
});

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const validation = QuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!validation.success) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const { page, limit, search, make, color, year, tax, mot } = validation.data;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const queryParams: (string | number)[] = [];

    const addCondition = (field: string, value: string | number | undefined, operator = "=") => {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            queryParams.push(operator === 'ILIKE' ? `%${value}%` : value);
            conditions.push(`${field} ${operator} $${queryParams.length}`);
        }
    };

    if (search) {
        queryParams.push(`%${search.toUpperCase().replace(/\s/g, '')}%`);
        conditions.push(`UPPER(REPLACE(plate_number, ' ', '')) ILIKE $${queryParams.length}`);
    }

    addCondition('car_make', make);
    addCondition('car_color', color);
    addCondition('year_of_manufacture', year);
    addCondition('tax_status', tax);
    addCondition('mot_status', mot);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const client = await pool.connect();
    try {
        const dataQuery = `SELECT * FROM license_plates ${whereClause} ORDER BY recent_capture_time DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
        const dataResult = await client.query(dataQuery, [...queryParams, limit, offset]);

        const countQuery = `SELECT COUNT(*) FROM license_plates ${whereClause}`;
        const countResult = await client.query(countQuery, queryParams);

        const stateResult = await client.query('SELECT last_plate_update FROM app_state WHERE id = 1');

        const makesQuery = "SELECT DISTINCT car_make FROM license_plates WHERE car_make IS NOT NULL ORDER BY car_make ASC";
        const colorsQuery = "SELECT DISTINCT car_color FROM license_plates WHERE car_color IS NOT NULL ORDER BY car_color ASC";
        const yearsQuery = "SELECT DISTINCT year_of_manufacture FROM license_plates WHERE year_of_manufacture IS NOT NULL ORDER BY year_of_manufacture DESC";
        const motStatusQuery = "SELECT DISTINCT mot_status FROM license_plates WHERE mot_status IS NOT NULL AND mot_status != '' ORDER BY mot_status ASC";
        const taxStatusQuery = "SELECT DISTINCT tax_status FROM license_plates WHERE tax_status IS NOT NULL AND tax_status != '' ORDER BY tax_status ASC";

        const [makesResult, colorsResult, yearsResult, motStatusResult, taxStatusResult] = await Promise.all([
            client.query(makesQuery),
            client.query(colorsQuery),
            client.query(yearsQuery),
            client.query(motStatusQuery),
            client.query(taxStatusQuery),
        ]);

        const totalRows = parseInt(countResult.rows[0].count, 10);
        return NextResponse.json({
            data: dataResult.rows,
            lastCheckedTimestamp: stateResult.rows[0]?.last_plate_update || new Date(0).toISOString(),
            pagination: { currentPage: page, totalPages: Math.ceil(totalRows / limit), totalRows },
            filterOptions: {
                makes: makesResult.rows.map(row => row.car_make),
                colors: colorsResult.rows.map(row => row.car_color),
                years: yearsResult.rows.map(row => row.year_of_manufacture),
                motStatuses: motStatusResult.rows.map(row => row.mot_status),
                taxStatuses: taxStatusResult.rows.map(row => row.tax_status),
            }
        });
    } catch (error: unknown) {
        console.error('API Error fetching plates:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        client.release();
    }
}