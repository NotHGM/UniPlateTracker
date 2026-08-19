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
 * Worth being precise about what "everything" means, because the schema is
 * narrower than it first appears. license_plates holds one row per plate,
 * upserted when that plate is seen again: capture_time is the first sighting
 * and recent_capture_time the most recent. Individual sightings in between are
 * not retained, and neither is a count of them.
 *
 * So this can honestly report when a vehicle was first and last seen, and
 * whether it has been seen more than once, but not how many times or when.
 * The page says as much rather than implying a history it does not have.
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

        const result = await client.query(
            `SELECT * FROM license_plates
             WHERE UPPER(REPLACE(plate_number, ' ', '')) = $1
             ORDER BY recent_capture_time DESC
             LIMIT 1`,
            [normalised],
        );

        if (result.rows.length === 0) return null;

        const vehicle = result.rows[0];

        return {
            plateNumber: vehicle.plate_number,
            vehicle,
            firstSeen: vehicle.capture_time,
            lastSeen: vehicle.recent_capture_time,
            /*
             * Whether this plate has ever been re-seen. The two timestamps
             * differ only once the upsert has fired at least a second time, so
             * this is the one thing the schema can say about repetition.
             */
            seenAgain:
                vehicle.capture_time &&
                vehicle.recent_capture_time &&
                new Date(vehicle.capture_time).getTime() !== new Date(vehicle.recent_capture_time).getTime(),
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
            repeatVehiclesResult,
            detectionsTodayResult,
            detectionsYesterdayResult,
            mostCommonMakeResult,
            mostCommonColorResult,
            detectionsByHourResult,
            detectionsByDayResult,
        ] = await Promise.all([
            client.query('SELECT COUNT(*) FROM license_plates'),
            /*
             * Vehicles seen more than once. license_plates stores one row per
             * plate, so COUNT(DISTINCT plate_number) was always identical to
             * COUNT(*) and the dashboard showed the same number twice. This
             * asks something the data can actually answer.
             */
            client.query('SELECT COUNT(*) FROM license_plates WHERE capture_time <> recent_capture_time'),
            client.query("SELECT COUNT(*) FROM license_plates WHERE recent_capture_time >= current_date"),
            /*
             * Yesterday's count, bounded at both ends so it is the whole of
             * yesterday rather than the last 24 hours. Comparing a partial
             * today against a rolling window would make the morning look like
             * a collapse in traffic every single day.
             */
            client.query(
                `SELECT COUNT(*) FROM license_plates
                 WHERE recent_capture_time >= current_date - interval '1 day'
                   AND recent_capture_time < current_date`,
            ),
            client.query("SELECT car_make, COUNT(*) as count FROM license_plates WHERE car_make IS NOT NULL GROUP BY car_make ORDER BY count DESC LIMIT 1"),
            client.query("SELECT car_color, COUNT(*) as count FROM license_plates WHERE car_color IS NOT NULL GROUP BY car_color ORDER BY count DESC LIMIT 1"),
            client.query(hourlyDetectionsQuery),
            client.query(dailyDetectionsQuery),
        ]);

        const stats = {
            totalPlates: parseInt(totalPlatesResult.rows[0].count, 10),
            repeatVehicles: parseInt(repeatVehiclesResult.rows[0].count, 10),
            detectionsToday: parseInt(detectionsTodayResult.rows[0].count, 10),
            detectionsYesterday: parseInt(detectionsYesterdayResult.rows[0].count, 10),
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
