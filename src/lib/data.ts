// src/lib/data.ts
import 'server-only';
import pool from '@/lib/db';

const hourlyDetectionsQuery = `
    WITH hours AS (
      SELECT generate_series(
        date_trunc('hour', now() - interval '23 hours'),
        date_trunc('hour', now()),
        '1 hour'
      ) AS hour
    )
    SELECT
      TO_CHAR(h.hour, 'HH24') AS hour,
      COALESCE(COUNT(lp.id), 0)::int AS count
    FROM hours h
    LEFT JOIN license_plates lp ON date_trunc('hour', lp.recent_capture_time) = h.hour
    GROUP BY h.hour
    ORDER BY h.hour;
`;

export async function getAdminStats() {
    const client = await pool.connect();
    try {
        const [
            totalPlatesResult,
            uniquePlatesResult,
            detectionsTodayResult,
            mostCommonMakeResult,
            mostCommonColorResult,
            detectionsByHourResult,
        ] = await Promise.all([
            client.query('SELECT COUNT(*) FROM license_plates'),
            client.query('SELECT COUNT(DISTINCT plate_number) FROM license_plates'),
            client.query("SELECT COUNT(*) FROM license_plates WHERE recent_capture_time >= current_date"),
            client.query("SELECT car_make, COUNT(*) as count FROM license_plates WHERE car_make IS NOT NULL GROUP BY car_make ORDER BY count DESC LIMIT 1"),
            client.query("SELECT car_color, COUNT(*) as count FROM license_plates WHERE car_color IS NOT NULL GROUP BY car_color ORDER BY count DESC LIMIT 1"),
            client.query(hourlyDetectionsQuery),
        ]);

        const stats = {
            totalPlates: parseInt(totalPlatesResult.rows[0].count, 10),
            uniquePlates: parseInt(uniquePlatesResult.rows[0].count, 10),
            detectionsToday: parseInt(detectionsTodayResult.rows[0].count, 10),
            mostCommonMake: mostCommonMakeResult.rows[0] ? `${mostCommonMakeResult.rows[0].car_make} (${mostCommonMakeResult.rows[0].count})` : 'N/A',
            mostCommonColor: mostCommonColorResult.rows[0] ? `${mostCommonColorResult.rows[0].car_color} (${mostCommonColorResult.rows[0].count})` : 'N/A',
            detectionsByHour: detectionsByHourResult.rows.map(r => ({ hour: r.hour, count: r.count })),
        };

        return stats;

    } finally {
        client.release();
    }
}