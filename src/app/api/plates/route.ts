// src/app/api/plates/route.ts
import { NextResponse, NextRequest } from 'next/server';
import pool from '@/lib/db';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { FilterSchema, buildPlateQuery } from '@/lib/plate-filters';

/*
 * Filtering and sorting live in lib/plate-filters so that this route and the
 * CSV export apply identical rules. An export that quietly filters differently
 * from the table it was launched from produces a file that looks right and is
 * wrong.
 */
const QuerySchema = FilterSchema.extend({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
});

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const validation = QuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!validation.success) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const { page, limit, ...filters } = validation.data;
    const offset = (page - 1) * limit;

    const { whereClause, params: queryParams, orderBy } = buildPlateQuery(filters);

    let client: PoolClient | null = null;
    try {
        const dbClient: PoolClient = await pool.connect();
        client = dbClient;

        const dataQuery = `SELECT * FROM license_plates ${whereClause} ${orderBy} LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
        const dataResult = await dbClient.query(dataQuery, [...queryParams, limit, offset]);

        const countQuery = `SELECT COUNT(*) FROM license_plates ${whereClause}`;
        const countResult = await dbClient.query(countQuery, queryParams);

        const stateResult = await dbClient.query('SELECT last_plate_update FROM app_state WHERE id = 1');

        const makesQuery = "SELECT DISTINCT car_make FROM license_plates WHERE car_make IS NOT NULL ORDER BY car_make ASC";
        const colorsQuery = "SELECT DISTINCT car_color FROM license_plates WHERE car_color IS NOT NULL ORDER BY car_color ASC";
        const yearsQuery = "SELECT DISTINCT year_of_manufacture FROM license_plates WHERE year_of_manufacture IS NOT NULL ORDER BY year_of_manufacture DESC";
        const motStatusQuery = "SELECT DISTINCT mot_status FROM license_plates WHERE mot_status IS NOT NULL AND mot_status != '' ORDER BY mot_status ASC";
        const taxStatusQuery = "SELECT DISTINCT tax_status FROM license_plates WHERE tax_status IS NOT NULL AND tax_status != '' ORDER BY tax_status ASC";

        const [makesResult, colorsResult, yearsResult, motStatusResult, taxStatusResult] = await Promise.all([
            dbClient.query(makesQuery),
            dbClient.query(colorsQuery),
            dbClient.query(yearsQuery),
            dbClient.query(motStatusQuery),
            dbClient.query(taxStatusQuery),
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
        client?.release();
    }
}