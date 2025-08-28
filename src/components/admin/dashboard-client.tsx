// src/components/admin/dashboard-client.tsx
"use client"

import { Car, Palette, Timer, Fingerprint } from "lucide-react";
import { StatCard } from "./stat-card";
import { DetectionsChart } from "./detections-chart";

export function DashboardClient({ stats }: { stats: any }) {
    if (!stats) return <p>Loading stats...</p>;

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <StatCard title="Total Detections" value={stats.totalPlates} icon={Car} />
                <StatCard title="Unique Plates" value={stats.uniquePlates} icon={Fingerprint} />
                <StatCard title="Detections Today" value={stats.detectionsToday} icon={Timer} />
                <StatCard title="Most Common Make" value={stats.mostCommonMake} icon={Car} />
                <StatCard title="Most Common Color" value={stats.mostCommonColor} icon={Palette} />
            </div>

            <DetectionsChart data={stats.detectionsByHour} />

            <div className="grid gap-4 md:grid-cols-2">
            </div>
        </div>
    )
}