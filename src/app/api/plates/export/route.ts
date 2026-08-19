// src/app/api/plates/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { FilterSchema, buildPlateQuery } from "@/lib/plate-filters";

/**
 * CSV of the current result set.
 *
 * Exports everything matching the filters, not the page currently on screen.
 * Exporting the visible slice is the kind of bug nobody catches: the file
 * opens, it has rows in it, and it silently omits 99% of the data. The filters
 * come from the same builder the table uses, so the two cannot disagree.
 *
 * Streamed row by row rather than assembled in memory, because the result set
 * is unbounded by definition — "no filters" means the entire table.
 */

/** Rows fetched per round trip from the server-side cursor. */
const BATCH_SIZE = 500;

const COLUMNS = [
    "plate_number",
    "recent_capture_time",
    "car_make",
    "car_color",
    "fuel_type",
    "year_of_manufacture",
    "month_of_first_registration",
    "mot_status",
    "mot_expiry_date",
    "tax_status",
    "tax_due_date",
    "video_url",
] as const;

const HEADERS = [
    "Plate",
    "Last seen",
    "Make",
    "Colour",
    "Fuel",
    "Year",
    "First registered",
    "MOT status",
    "MOT expires",
    "Tax status",
    "Tax due",
    "Clip",
];

/**
 * Escapes a value for CSV.
 *
 * The leading apostrophe guard is deliberate. A field beginning with =, +, -
 * or @ is interpreted as a formula by Excel and Sheets, so an attacker-chosen
 * plate could execute on open — a plate is attacker-controlled input, since
 * anyone can drive past the camera with whatever is bolted to their car.
 */
function csvCell(value: unknown): string {
    if (value === null || value === undefined) return "";

    let text = value instanceof Date ? value.toISOString() : String(value);

    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

    return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
    const parsed = FilterSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
    }

    const { whereClause, params, orderBy } = buildPlateQuery(parsed.data);
    const client = await pool.connect();

    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        client.release();
    };

    try {
        await client.query("BEGIN");
        await client.query(
            `DECLARE plate_export CURSOR FOR
             SELECT ${COLUMNS.join(", ")} FROM license_plates ${whereClause} ${orderBy}`,
            params,
        );

        const encoder = new TextEncoder();

        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                // A BOM so Excel opens UTF-8 correctly rather than mangling it.
                controller.enqueue(encoder.encode("﻿" + HEADERS.join(",") + "\r\n"));
            },

            async pull(controller) {
                try {
                    const batch = await client.query(`FETCH ${BATCH_SIZE} FROM plate_export`);

                    if (batch.rows.length === 0) {
                        await client.query("COMMIT").catch(() => {});
                        release();
                        controller.close();
                        return;
                    }

                    const chunk = batch.rows
                        .map((row) => COLUMNS.map((column) => csvCell(row[column])).join(","))
                        .join("\r\n");

                    controller.enqueue(encoder.encode(chunk + "\r\n"));
                } catch (error) {
                    await client.query("ROLLBACK").catch(() => {});
                    release();
                    controller.error(error);
                }
            },

            // Fires if the client disconnects mid-download. Without this the
            // cursor and its connection leak out of the pool.
            async cancel() {
                await client.query("ROLLBACK").catch(() => {});
                release();
            },
        });

        const stamp = new Date().toISOString().slice(0, 10);

        return new NextResponse(stream, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="detections-${stamp}.csv"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("CSV export failed:", error);
        await client.query("ROLLBACK").catch(() => {});
        release();
        return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
}
