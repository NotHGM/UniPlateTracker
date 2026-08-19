import "server-only";
import { z } from "zod";

/**
 * Filter and sort handling shared by the plates list and the CSV export.
 *
 * These have to be one implementation. An export that quietly applies
 * different filters from the table it was launched from produces a file that
 * looks right and is wrong, which is worse than an export that fails.
 */

/**
 * Sortable columns, as an allow-list.
 *
 * A column name is part of the SQL text rather than a value, so it cannot be
 * passed as a parameter. The only safe way to accept one from a client is to
 * map an opaque key onto a literal defined here; interpolating the request
 * value would be an injection point.
 */
export const SORT_COLUMNS = {
    seen: "recent_capture_time",
    plate: "plate_number",
    make: "car_make",
    year: "year_of_manufacture",
    mot: "mot_status",
    tax: "tax_status",
} as const;

export type SortKey = keyof typeof SORT_COLUMNS;

export const FilterSchema = z.object({
    search: z.string().optional(),
    make: z.string().optional(),
    color: z.string().optional(),
    year: z.coerce.number().int().optional(),
    tax: z.string().optional(),
    mot: z.string().optional(),
    sort: z.enum(Object.keys(SORT_COLUMNS) as [SortKey]).default("seen"),
    dir: z.enum(["asc", "desc"]).default("desc"),
});

export type PlateFilters = z.infer<typeof FilterSchema>;

export interface BuiltQuery {
    whereClause: string;
    params: (string | number)[];
    orderBy: string;
}

export function buildPlateQuery(filters: PlateFilters): BuiltQuery {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    const addCondition = (field: string, value: string | number | undefined) => {
        if (value === undefined || value === null || value === "" || value === "all") return;
        params.push(value);
        conditions.push(`${field} = $${params.length}`);
    };

    if (filters.search) {
        // Compared with spaces stripped and case folded on both sides, so that
        // "gl75 vfr" matches a plate stored as GL75VFR.
        params.push(`%${filters.search.toUpperCase().replace(/\s/g, "")}%`);
        conditions.push(`UPPER(REPLACE(plate_number, ' ', '')) ILIKE $${params.length}`);
    }

    addCondition("car_make", filters.make);
    addCondition("car_color", filters.color);
    addCondition("year_of_manufacture", filters.year);
    addCondition("tax_status", filters.tax);
    addCondition("mot_status", filters.mot);

    /*
     * NULLS LAST because most sortable columns are nullable — a vehicle the
     * DVLA holds no record for has no make, MOT or tax status — and Postgres
     * sorts nulls first on DESC, which would open every descending sort with a
     * screen of blanks.
     *
     * The id tiebreak keeps paging stable: without it, rows sharing a value can
     * come back in a different order per query, so the same row appears on two
     * pages or on neither.
     */
    const orderBy = `ORDER BY ${SORT_COLUMNS[filters.sort]} ${filters.dir === "asc" ? "ASC" : "DESC"} NULLS LAST, id DESC`;

    return {
        whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
        params,
        orderBy,
    };
}
