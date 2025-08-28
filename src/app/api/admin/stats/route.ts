// src/app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    const client = await pool.connect();
    try {
        const [
            totalPlatesResult,
            uniquePlatesResult,
            detectionsTodayResult,
            mostCommonMakeResult,
            mostCommonColorResult,
            motStatusResult,
            taxStatusResult,
            detectionsByHourResult,
        ] = await Promise.all([
            client.query('SELECT COUNT(*) FROM license_plates'),
            client.query('SELECT COUNT(DISTINCT plate_number) FROM license_plates'),
            client.query("SELECT COUNT(*) FROM license_plates WHERE recent_capture_time >= current_date"),
            client.query("SELECT car_make, COUNT(*) as count FROM license_plates WHERE car_make IS NOT NULL GROUP BY car_make ORDER BY count DESC LIMIT 1"),
            client.query("SELECT car_color, COUNT(*) as count FROM license_plates WHERE car_color IS NOT NULL GROUP BY car_color ORDER BY count DESC LIMIT 1"),
            client.query("SELECT mot_status, COUNT(*) as count FROM license_plates WHERE mot_status IS NOT NULL GROUP BY mot_status"),
            client.query("SELECT tax_status, COUNT(*) as count FROM license_plates WHERE tax_status IS NOT NULL GROUP BY tax_status"),
            client.query(`
                SELECT to_char(recent_capture_time, 'HH24') as hour, COUNT(*) as count
                FROM license_plates
                WHERE recent_capture_time >= NOW() - INTERVAL '24 hours'
                GROUP BY hour
                ORDER BY hour ASC
            `),
        ]);

        const stats = {
            totalPlates: parseInt(totalPlatesResult.rows[0].count, 10),
            uniquePlates: parseInt(uniquePlatesResult.rows[0].count, 10),
            detectionsToday: parseInt(detectionsTodayResult.rows[0].count, 10),
            mostCommonMake: mostCommonMakeResult.rows[0] ? `${mostCommonMakeResult.rows[0].car_make} (${mostCommonMakeResult.rows[0].count})` : 'N/A',
            mostCommonColor: mostCommonColorResult.rows[0] ? `${mostCommonColorResult.rows[0].car_color} (${mostCommonColorResult.rows[0].count})` : 'N/A',
            motStatus: motStatusResult.rows,
            taxStatus: taxStatusResult.rows,
            detectionsByHour: detectionsByHourResult.rows.map(r => ({ hour: `${r.hour}:00`, count: parseInt(r.count, 10) })),
        };

        return NextResponse.json(stats);

    } catch (error) {
        console.error('API Admin Stats Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        client.release();
    }
}