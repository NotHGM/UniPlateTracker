import React from "react";
import { cn } from "@/lib/utils";
import styles from "./plates.module.css";

/**
 * Shared presentation primitives for a detected plate.
 *
 * These live apart from the table because the table is no longer the only
 * thing that renders them: the narrow-viewport card list shows the same
 * plate, the same status and the same absence-of-data, and two copies of
 * that logic would drift the moment either one is touched.
 */

/**
 * Splits a registration into its two visual groups.
 *
 * A UK plate is read as two blocks — two letters and two digits, then three
 * letters — and running them together makes it noticeably harder to scan a
 * column of them. The gap is a thin inline spacer rather than a space
 * character so that copying the text yields the raw registration, which is
 * what anyone pasting it into a search or a report actually wants.
 */
export function formatPlate(plate: string | null): React.ReactNode {
    if (!plate) return <>{"N/A"}</>;

    const compact = plate.replace(/\s/g, "");
    const splitAt = compact.length >= 7 ? 4 : compact.length === 6 ? 3 : 0;

    if (splitAt === 0) return <span>{compact}</span>;

    return (
        <>
            <span>{compact.substring(0, splitAt)}</span>
            <span style={{ display: "inline-block", width: "0.25em" }} />
            <span>{compact.substring(splitAt)}</span>
        </>
    );
}

/** The plate itself, rendered as the physical object it is. */
export function PlateTag({
    plateNumber,
    appRegion,
    className,
}: {
    plateNumber: string | null;
    appRegion: "UK" | "INTERNATIONAL";
    className?: string;
}) {
    return (
        <div className={cn(appRegion === "UK" ? styles.ukPlateStyle : styles.intlPlateStyle, className)}>
            {formatPlate(plateNumber)}
        </div>
    );
}

/**
 * How a DVLA status string maps to a visual weight.
 *
 * Deliberately conservative about what counts as good news. Anything the
 * DVLA did not tell us falls through to the neutral treatment rather than
 * being coloured, because an unknown status is missing information and
 * should not look like a clean bill of health.
 */
export function getStatusTone(status: string | null): "success" | "destructive" | "warning" | "neutral" {
    if (!status) return "neutral";

    const lower = status.toLowerCase();
    if (lower === "valid" || lower === "taxed") return "success";
    if (lower.includes("expire") || lower.includes("due") || lower.includes("not taxed")) return "destructive";
    if (lower.includes("sorn") || lower.includes("untaxed")) return "warning";
    return "neutral";
}

const TONE_CLASS: Record<ReturnType<typeof getStatusTone>, string> = {
    success: styles.badgeSuccess,
    destructive: styles.badgeDestructive,
    warning: styles.badgeWarning,
    neutral: styles.badgeSecondary,
};

/**
 * The DVLA returns this whole sentence where it holds no record. It is far
 * too long to sit in a badge next to values like "Valid" and "Taxed", and it
 * pushed the badge row onto a second line on narrow screens. Shortened for
 * display, with the original preserved in the title so nothing is lost.
 */
const NO_DVLA_RECORD = /no details held by dvla/i;

/**
 * `prefix` is display only and never feeds the tone lookup. Folding it into
 * the status string would silently break the match — "MOT Valid" is not
 * "Valid" — and turn a good status neutral without anything failing loudly.
 */
export function StatusBadge({ status, prefix }: { status: string | null; prefix?: string }) {
    const isUnknown = !status || NO_DVLA_RECORD.test(status);
    const text = isUnknown ? "Unknown" : (status as string);

    return (
        <div
            className={cn(styles.badge, TONE_CLASS[getStatusTone(status)])}
            title={isUnknown && status ? status : undefined}
        >
            {prefix ? `${prefix} ${text}` : text}
        </div>
    );
}
