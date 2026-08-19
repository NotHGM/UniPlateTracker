// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { stat } from "fs/promises";
import path from "path";
import pool from "@/lib/db";

/**
 * Whether the detection pipeline is actually working.
 *
 * This exists because of a real failure: video capture stopped writing files
 * and nothing said so for five months. Detections kept arriving, every row
 * kept recording a video_url, and the dashboard looked exactly as it does
 * when everything is fine. A monitoring tool that cannot tell "quiet" from
 * "broken" will hide that class of fault every time.
 *
 * Two independent things are checked, because they fail independently. The
 * webhook path writes rows; the worker records clips from the camera's RTSP
 * stream. Either can stop while the other carries on.
 */

/** How many recent clip references to stat. Enough to be confident, cheap enough to run often. */
const RECENT_CLIP_SAMPLE = 5;

export async function GET() {
    const client = await pool.connect();

    try {
        const [detectionResult, clipResult] = await Promise.all([
            client.query(
                `SELECT MAX(recent_capture_time) AS last_detection,
                        COUNT(*) FILTER (WHERE recent_capture_time >= now() - interval '24 hours') AS last_24h
                 FROM license_plates`,
            ),
            client.query(
                `SELECT video_url, recent_capture_time
                 FROM license_plates
                 WHERE video_url IS NOT NULL
                 ORDER BY recent_capture_time DESC
                 LIMIT $1`,
                [RECENT_CLIP_SAMPLE],
            ),
        ]);

        const lastDetection: string | null = detectionResult.rows[0]?.last_detection ?? null;
        const detectionsLast24h = Number(detectionResult.rows[0]?.last_24h ?? 0);

        const videoEnabled = process.env.ENABLE_VIDEO_CAPTURE === "true";
        const capturePath = process.env.VIDEO_FINAL_CAPTURE_PATH;

        /*
         * Checked against the filesystem rather than against the database,
         * because the database is exactly what lies here: the row records a
         * video_url whether or not the file was ever written. Only stat tells
         * the truth.
         *
         * Reported as a ratio rather than a boolean so a single missing clip —
         * which happens legitimately, e.g. a detection during a restart —
         * does not read the same as the pipeline being down.
         */
        let clipsChecked = 0;
        let clipsPresent = 0;
        let lastClipAt: string | null = null;

        if (videoEnabled && capturePath) {
            for (const row of clipResult.rows) {
                const fileName = path.basename(String(row.video_url));
                clipsChecked += 1;

                try {
                    await stat(path.join(capturePath, fileName));
                    clipsPresent += 1;
                    if (!lastClipAt) lastClipAt = row.recent_capture_time;
                } catch {
                    // Missing file. That is the signal, not an error.
                }
            }
        }

        const captureBroken = videoEnabled && clipsChecked > 0 && clipsPresent === 0;

        return NextResponse.json(
            {
                lastDetection,
                detectionsLast24h,
                video: {
                    enabled: videoEnabled,
                    configured: Boolean(capturePath),
                    clipsChecked,
                    clipsPresent,
                    lastClipAt,
                    broken: captureBroken,
                },
            },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("Health check failed:", error);
        return NextResponse.json({ error: "Health check failed" }, { status: 500 });
    } finally {
        client.release();
    }
}
