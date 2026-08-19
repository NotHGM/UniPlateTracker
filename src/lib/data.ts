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

const dailyDetectionsQuery = `
    WITH days AS (
      SELECT generate_series(
        (current_date - interval '364 days')::date,
        current_date::date,
        '1 day'
      )::date AS day
    )
    SELECT
      TO_CHAR(d.day, 'YYYY-MM-DD') AS day,
      COALESCE(COUNT(lp.id), 0)::int AS count
    FROM days d
    LEFT JOIN license_plates lp ON (lp.recent_capture_time AT TIME ZONE 'UTC')::date = d.day
    GROUP BY d.day
    ORDER BY d.day;
`;

/**
 * Everything known about one registration.
 *
 * The list view answers "what has been seen recently". This answers "what do I
 * know about this vehicle", which is the question someone actually has when a
 * particular plate catches their eye — and which previously required reading
 * the table and hoping the same plate appeared again on the same page.
 *
 * Returns null when the plate has never been seen, so the caller can render a
 * 404 rather than an empty page that looks like a broken query.
 */
export async function getPlateHistory(plateNumber: string) {
    const client = await pool.connect();

    try {
        // Normalised on both sides so a URL carrying "GL75 VFR" or "gl75vfr"
        // finds a row stored as GL75VFR.
        const normalised = plateNumber.toUpperCase().replace(/\s/g, "");

        const sightingsResult = await client.query(
            `SELECT * FROM license_plates
             WHERE UPPER(REPLACE(plate_number, ' ', '')) = $1
             ORDER BY recent_capture_time DESC`,
            [normalised],
        );

        if (sightingsResult.rows.length === 0) return null;

        const sightings = sightingsResult.rows;

        /*
         * Vehicle details come from the most recent sighting rather than being
         * merged across all of them. DVLA data changes over time — a car gets
         * taxed, an MOT expires — and showing the newest known state is
         * honest, whereas combining fields from different dates would invent a
         * vehicle that never existed in that condition.
         */
        return {
            plateNumber: sightings[0].plate_number,
            vehicle: sightings[0],
            sightings,
            firstSeen: sightings[sightings.length - 1].recent_capture_time,
            lastSeen: sightings[0].recent_capture_time,
            totalSightings: sightings.length,
        };
    } finally {
        client.release();
    }
}

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
            detectionsByDayResult,
        ] = await Promise.all([
            client.query('SELECT COUNT(*) FROM license_plates'),
            client.query('SELECT COUNT(DISTINCT plate_number) FROM license_plates'),
            client.query("SELECT COUNT(*) FROM license_plates WHERE recent_capture_time >= current_date"),
            client.query("SELECT car_make, COUNT(*) as count FROM license_plates WHERE car_make IS NOT NULL GROUP BY car_make ORDER BY count DESC LIMIT 1"),
            client.query("SELECT car_color, COUNT(*) as count FROM license_plates WHERE car_color IS NOT NULL GROUP BY car_color ORDER BY count DESC LIMIT 1"),
            client.query(hourlyDetectionsQuery),
            client.query(dailyDetectionsQuery),
        ]);

        const stats = {
            totalPlates: parseInt(totalPlatesResult.rows[0].count, 10),
            uniquePlates: parseInt(uniquePlatesResult.rows[0].count, 10),
            detectionsToday: parseInt(detectionsTodayResult.rows[0].count, 10),
            mostCommonMake: mostCommonMakeResult.rows[0] ? `${mostCommonMakeResult.rows[0].car_make} (${mostCommonMakeResult.rows[0].count})` : 'N/A',
            mostCommonColor: mostCommonColorResult.rows[0] ? `${mostCommonColorResult.rows[0].car_color} (${mostCommonColorResult.rows[0].count})` : 'N/A',
            detectionsByHour: detectionsByHourResult.rows.map(r => ({ hour: r.hour, count: r.count })),
            detectionsByDay: detectionsByDayResult.rows.map(r => ({ day: r.day, count: r.count })),
        };

        return stats;

    } finally {
        client.release();
    }
}
