"use client";

import useSWR from "swr";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { cn } from "@/lib/utils";

dayjs.extend(relativeTime);

interface Health {
    lastDetection: string | null;
    detectionsLast24h: number;
    video: {
        enabled: boolean;
        configured: boolean;
        clipsChecked: number;
        clipsPresent: number;
        lastClipAt: string | null;
        broken: boolean;
    };
}

/**
 * How long without a detection before the pipeline is considered stalled.
 *
 * Generous on purpose. A driveway camera can legitimately see nothing
 * overnight, and an indicator that cries wolf every morning gets ignored,
 * which defeats the point of having one. Six hours of complete silence on a
 * camera that normally reports daily is worth a second look; two hours is not.
 */
const STALE_AFTER_HOURS = 6;

type Tone = "ok" | "warn" | "alert";

function describe(health: Health | undefined): { tone: Tone; label: string; detail: string } | null {
    if (!health) return null;

    // Capture being down is reported ahead of detection age, because it is the
    // more specific fault and the one that hides for months.
    if (health.video.broken) {
        return {
            tone: "alert",
            label: "Capture failing",
            detail: `Detections are arriving, but none of the last ${health.video.clipsChecked} clips were written to disk. Check the worker and FFmpeg.`,
        };
    }

    if (!health.lastDetection) {
        return { tone: "warn", label: "No detections", detail: "Nothing has been recorded yet." };
    }

    const age = dayjs().diff(dayjs(health.lastDetection), "hour");

    if (age >= STALE_AFTER_HOURS) {
        return {
            tone: "warn",
            label: "No recent detections",
            detail: `Last detection ${dayjs(health.lastDetection).fromNow()}. The camera or webhook may have stopped.`,
        };
    }

    return {
        tone: "ok",
        label: "Live",
        detail: `${health.detectionsLast24h.toLocaleString("en-GB")} detections in the last 24 hours. Most recent ${dayjs(health.lastDetection).fromNow()}.`,
    };
}

const TONE_DOT: Record<Tone, string> = {
    ok: "bg-status-ok",
    warn: "bg-status-warn",
    alert: "bg-status-alert",
};

const TONE_TEXT: Record<Tone, string> = {
    ok: "text-muted-foreground",
    warn: "text-status-warn",
    alert: "text-status-alert",
};

/**
 * Whether events are still flowing, shown in the header.
 *
 * The healthy state is deliberately understated — a grey label and a small
 * dot — because "working normally" is the case 99% of the time and does not
 * need to compete for attention. It earns colour only when something is
 * wrong, which is the same principle the status chips follow in the table.
 */
export function PipelineStatus() {
    const { data } = useSWR<Health>("/api/health", (url: string) => fetch(url).then((r) => r.json()), {
        refreshInterval: 60_000,
        revalidateOnFocus: true,
    });

    const state = describe(data);

    // Nothing is rendered until the state is known, rather than guessing at a
    // healthy default and having to retract it.
    if (!state) return <div className="h-5" aria-hidden />;

    return (
        <div
            className={cn("hidden md:flex items-center gap-1.5 text-xs", TONE_TEXT[state.tone])}
            title={state.detail}
        >
            <span
                className={cn(
                    "size-1.5 rounded-full shrink-0",
                    TONE_DOT[state.tone],
                    // Only a fault animates. A pulsing dot on the healthy state
                    // is decoration; here it is the alarm.
                    state.tone === "alert" && "motion-safe:animate-pulse",
                )}
                aria-hidden
            />
            <span>{state.label}</span>
            <span className="sr-only">. {state.detail}</span>
        </div>
    );
}
