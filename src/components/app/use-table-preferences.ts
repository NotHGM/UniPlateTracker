"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * How the operator wants the table laid out.
 *
 * Kept in localStorage rather than the URL, unlike filters and sorting. The
 * distinction is deliberate: a filter is part of a question you might want to
 * share or bookmark, whereas density and column choice are about this person
 * on this screen. Putting them in the URL would mean pasting a link to a
 * colleague also imposed your layout on them.
 */

export type Density = "comfortable" | "compact";

/** Columns the operator can hide. Plate and last seen are not listed because a
 *  row with neither identifies nothing and dates nothing. */
export const OPTIONAL_COLUMNS = {
    image: "Image",
    vehicle: "Vehicle",
    mot: "MOT",
    tax: "Tax",
    registration: "Registration",
    video: "Video",
} as const;

export type ColumnKey = keyof typeof OPTIONAL_COLUMNS;

export interface TablePreferences {
    density: Density;
    hiddenColumns: ColumnKey[];
}

const STORAGE_KEY = "uniplatetracker.table-preferences";

const DEFAULTS: TablePreferences = { density: "comfortable", hiddenColumns: [] };

function parse(raw: string | null): TablePreferences {
    if (!raw) return DEFAULTS;

    try {
        const parsed = JSON.parse(raw) as Partial<TablePreferences>;

        return {
            density: parsed.density === "compact" ? "compact" : "comfortable",
            // Filtered against the current column list so a stored key from an
            // older version cannot hide a column that no longer exists, or
            // survive as junk forever.
            hiddenColumns: Array.isArray(parsed.hiddenColumns)
                ? parsed.hiddenColumns.filter((key): key is ColumnKey => key in OPTIONAL_COLUMNS)
                : [],
        };
    } catch {
        return DEFAULTS;
    }
}

export function useTablePreferences() {
    /*
     * Starts at the defaults on both server and client, then reads storage in
     * an effect. Reading localStorage during render would produce different
     * markup on the server than the client and trip a hydration mismatch,
     * which React resolves by throwing the server markup away.
     */
    const [preferences, setPreferences] = useState<TablePreferences>(DEFAULTS);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setPreferences(parse(window.localStorage.getItem(STORAGE_KEY)));
        setIsHydrated(true);
    }, []);

    const update = useCallback((next: Partial<TablePreferences>) => {
        setPreferences((current) => {
            const merged = { ...current, ...next };

            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            } catch {
                // Private browsing, or storage full. The preference still
                // applies for this session; failing to persist it is not worth
                // interrupting anyone over.
            }

            return merged;
        });
    }, []);

    const toggleColumn = useCallback(
        (column: ColumnKey) => {
            setPreferences((current) => {
                const hidden = current.hiddenColumns.includes(column)
                    ? current.hiddenColumns.filter((key) => key !== column)
                    : [...current.hiddenColumns, column];

                const merged = { ...current, hiddenColumns: hidden };

                try {
                    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                } catch {
                    /* see above */
                }

                return merged;
            });
        },
        [],
    );

    const isVisible = useCallback(
        (column: ColumnKey) => !preferences.hiddenColumns.includes(column),
        [preferences.hiddenColumns],
    );

    return { preferences, update, toggleColumn, isVisible, isHydrated };
}
