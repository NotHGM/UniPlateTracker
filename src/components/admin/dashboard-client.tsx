"use client";

import { Activity, Car, Palette, Repeat, Timer } from "lucide-react";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "./stat-card";
import { AdminManagement } from "./admin-management";
import { AdminActivityLog } from "./admin-activity-log";
import { DetectionsChart } from "./detections-chart";

interface AdminStats {
    totalPlates: number;
    repeatVehicles: number;
    detectionsToday: number;
    detectionsYesterday?: number;
    mostCommonMake: string;
    mostCommonColor: string;
    detectionsByHour?: { hour: string; count: number }[];
    detectionsByDay?: { day: string; count: number }[];
}

/**
 * Describes today against yesterday, in words.
 *
 * Plain secondary text rather than a coloured percentage badge. On a driveway
 * camera the day-to-day difference is almost always noise, and a red or green
 * pill on noise trains people to ignore the one time it means something.
 */
function describeToday(today: number, yesterday: number | undefined): string | undefined {
    if (yesterday === undefined) return undefined;
    if (yesterday === 0) return today === 0 ? "None yesterday either" : "None yesterday";

    const difference = today - yesterday;
    if (difference === 0) return "Same as yesterday";

    const percent = Math.round((Math.abs(difference) / yesterday) * 100);
    return `${difference > 0 ? "Up" : "Down"} ${percent}% on yesterday (${yesterday.toLocaleString("en-GB")})`;
}

export function DashboardClient({
    stats,
    currentUserEmail,
}: {
    stats: AdminStats | null;
    currentUserEmail: string;
}) {
    const { data } = useSWR("/api/admin/management", (url) => fetch(url).then((res) => res.json()));

    /*
     * Who the initial admin is comes from initialAdminEmail, which the API
     * already returns and which is derived from the lowest admin_users id.
     *
     * This previously inferred it instead, by looking up the current user in
     * the approved-emails list and testing added_by_email === null. That is a
     * proxy, not the fact: any approved email whose adder is null — a seeded
     * row, or one whose adding account was later deleted — satisfies it too.
     * It gates the audit log, so it should be decided by the authoritative
     * field rather than by a shape that happens to correlate.
     */
    const amIInitialAdmin = Boolean(data?.initialAdminEmail) && data.initialAdminEmail === currentUserEmail;

    if (!stats) {
        return (
            <div className="space-y-6">
                {/* Skeletons match the real card height so the layout does not
                    jump when the data lands. */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {Array.from({ length: 5 }, (_, i) => (
                        <Skeleton key={i} className="h-[132px]" />
                    ))}
                </div>
                <Skeleton className="h-[400px]" />
            </div>
        );
    }

    // Two weeks is enough to show a rhythm without the sparkline becoming a
    // scribble at card width.
    const recentDays = (stats.detectionsByDay ?? []).slice(-14).map((d) => d.count);

    return (
        <div className="space-y-6">
            <section aria-label="Summary">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCard
                        title="Seen today"
                        value={stats.detectionsToday}
                        icon={Timer}
                        context={describeToday(stats.detectionsToday, stats.detectionsYesterday)}
                        series={recentDays}
                        emphasis
                    />
                    {/*
                      * "Vehicles seen", not "Total detections". license_plates
                      * holds one row per plate, so this counts distinct
                      * vehicles and never the number of times they drove past.
                      * The old label claimed a figure the schema does not hold.
                      */}
                    <StatCard title="Vehicles seen" value={stats.totalPlates} icon={Activity} />
                    <StatCard
                        title="Seen more than once"
                        value={stats.repeatVehicles}
                        icon={Repeat}
                        context={
                            stats.totalPlates > 0
                                ? `${Math.round((stats.repeatVehicles / stats.totalPlates) * 100)}% of all vehicles`
                                : undefined
                        }
                    />
                    <StatCard title="Most common make" value={stats.mostCommonMake} icon={Car} />
                    <StatCard title="Most common colour" value={stats.mostCommonColor} icon={Palette} />
                </div>
            </section>

            <DetectionsChart
                detectionsByHour={stats.detectionsByHour ?? []}
                detectionsByDay={stats.detectionsByDay ?? []}
            />

            {/*
              * Access control and its audit trail sit side by side on wide
              * screens because they are one subject: the log exists to explain
              * the list above it. Stacked, you cannot see both at once, which
              * is exactly when you want them — while checking whether a
              * revoked account was revoked by someone who should have.
              */}
            <div className="grid gap-4 xl:grid-cols-2 items-start">
                <AdminManagement currentUserEmail={currentUserEmail} />
                {amIInitialAdmin && <AdminActivityLog />}
            </div>
        </div>
    );
}
