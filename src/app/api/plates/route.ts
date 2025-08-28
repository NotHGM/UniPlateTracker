// src/app/api/plates/route.ts
import { NextResponse } from 'next/server';
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

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const validation = QuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!validation.success) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const { page, limit, search, make, color, year, tax, mot } = validation.data;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const queryParams: (string | number)[] = [];

    const addCondition = (field: string, value: any, operator: string = "=") => {
        if (value !== undefined && value !== null && value !== '') {
            const paramValue = operator === 'ILIKE' ? `%${value}%` : value;
            queryParams.push(paramValue);
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

        const makesQuery = "SELECT DISTINCT car_make FROM license_plates WHERE car_make IS NOT NULL ORDER BY car_make ASC";
        const colorsQuery = "SELECT DISTINCT car_color FROM license_plates WHERE car_color IS NOT NULL ORDER BY car_color ASC";
        const yearsQuery = "SELECT DISTINCT year_of_manufacture FROM license_plates WHERE year_of_manufacture IS NOT NULL ORDER BY year_of_manufacture DESC";

        const [makesResult, colorsResult, yearsResult] = await Promise.all([
            client.query(makesQuery),
            client.query(colorsQuery),
            client.query(yearsQuery),
        ]);

        const totalRows = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalRows / limit);

        return NextResponse.json({
            data: dataResult.rows,
            pagination: { currentPage: page, totalPages, totalRows },
            filterOptions: {
                makes: makesResult.rows.map(row => row.car_make),
                colors: colorsResult.rows.map(row => row.car_color),
                years: yearsResult.rows.map(row => row.year_of_manufacture),
            }
        });

    } catch (error) {
        console.error('API Error fetching plates:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        client.release();
    }
}