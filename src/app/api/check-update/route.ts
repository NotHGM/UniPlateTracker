// src/app/api/check-update/route.ts
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT last_plate_update FROM app_state WHERE id = 1');
        const lastUpdate = result.rows[0]?.last_plate_update || new Date(0).toISOString();

        return NextResponse.json({ lastUpdate });
    } catch (error) {
        console.error('API check-update Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        client.release();
    }
}