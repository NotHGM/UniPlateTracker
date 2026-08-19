// src/app/api/plates/route.ts
import { NextResponse, NextRequest } from 'next/server';
import pool from '@/lib/db';
import { z } from 'zod';
import type { PoolClient } from 'pg';

/**
 * Sortable columns, as an allow-list.
 *
 * A column name cannot be passed as a query parameter — it is part of the SQL
 * text, not a value — so the only safe way to accept one from the client is to
 * map an opaque key onto a literal defined here. Interpolating the request
 * value directly would be an injection point.
 *
 * Sorting has to happen in the database for a second reason. The client only
 * ever holds one page of a result set that is currently 4,279 rows, so sorting
 * what it has produces a confidently ordered page that is not the top of
 * anything — wrong in a way nobody notices.
 */
const SORT_COLUMNS = {
    seen: "recent_capture_time",
    plate: "plate_number",
    make: "car_make",
    year: "year_of_manufacture",
    mot: "mot_status",
    tax: "tax_status",
} as const;

const QuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().optional(),
    make: z.string().optional(),
    color: z.string().optional(),
    year: z.coerce.number().int().optional(),
    tax: z.string().optional(),
    mot: z.string().optional(),
    sort: z.enum(Object.keys(SORT_COLUMNS) as [keyof typeof SORT_COLUMNS]).default("seen"),
    dir: z.enum(["asc", "desc"]).default("desc"),
});

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const validation = QuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!validation.success) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const { page, limit, search, make, color, year, tax, mot, sort, dir } = validation.data;
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
    let client: PoolClient | null = null;
    try {
        const dbClient: PoolClient = await pool.connect();
        client = dbClient;

        /*
         * Both halves of the ORDER BY come from validated enums rather than
         * from the request text, so neither can carry arbitrary SQL.
         *
         * NULLS LAST matters here because most sortable columns are nullable:
         * a vehicle the DVLA holds no record for has no make, MOT or tax
         * status. Postgres sorts nulls first on DESC by default, which would
         * open every descending sort with a screen of blanks.
         *
         * The id tiebreak keeps paging stable. Without it, rows sharing a
         * value — every plate with the same make, say — can come back in a
         * different order per query, so the same row appears on two pages or
         * on neither.
         */
        const sortColumn = SORT_COLUMNS[sort];
        const sortDirection = dir === "asc" ? "ASC" : "DESC";
        const orderBy = `ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, id DESC`;

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