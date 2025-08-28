import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { z } from 'zod';

const QuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    make: z.string().optional(),
    color: z.string().optional(),
    year: z.coerce.number().int().optional(),
    tax: z.string().optional(),
    mot: z.string().optional(),
    search: z.string().optional(),
});

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const validation = QuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!validation.success) {
        return NextResponse.json(
            { error: 'Invalid query parameters', details: validation.error.flatten() },
            { status: 400 }
        );
    }

    const { page, limit, make, color, year, tax, mot, search } = validation.data;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const queryParams: (string | number)[] = [];

    const addCondition = (field: string, value: any, operator: string = "=") => {
        if (value) {
            let paramValue = operator === 'ILIKE' ? `%${value}%` : value;
            queryParams.push(paramValue);
            conditions.push(`${field} ${operator} $${queryParams.length}`);
        }
    };

    if (search) {
        queryParams.push(`%${search.toUpperCase().replace(/\s/g, '')}%`);
        conditions.push(`UPPER(REPLACE(plate_number, ' ', '')) ILIKE $${queryParams.length}`);
    }

    addCondition('UPPER(car_make)', make?.toUpperCase(), 'ILIKE');
    addCondition('UPPER(car_color)', color?.toUpperCase(), 'ILIKE');
    addCondition('year_of_manufacture', year);
    addCondition('tax_status', tax);
    addCondition('mot_status', mot);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const client = await pool.connect();
    try {
        const dataQuery = `
            SELECT * FROM license_plates
                              ${whereClause}
            ORDER BY recent_capture_time DESC
                LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `;
        const dataResult = await client.query(dataQuery, [...queryParams, limit, offset]);

        const countQuery = `SELECT COUNT(*) FROM license_plates ${whereClause}`;
        const countResult = await client.query(countQuery, queryParams);

        const totalRows = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalRows / limit);

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
        client.release();
    }
}