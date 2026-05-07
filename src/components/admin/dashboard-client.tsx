"use client";

import { Activity, Car, Fingerprint, Palette, Timer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "./stat-card";
import { AdminManagement } from "./admin-management";
import { AdminActivityLog } from "./admin-activity-log";
import { DetectionsChart } from "./detections-chart";
import useSWR from "swr";

interface Admin { email: string; added_by_email: string | null; }
interface AdminStats {
    totalPlates: number;
    uniquePlates: number;
    detectionsToday: number;
    mostCommonMake: string;
    mostCommonColor: string;
    detectionsByHour?: { hour: string; count: number }[];
    detectionsByDay?: { day: string; count: number }[];
}

export function DashboardClient({ stats, currentUserEmail }: { stats: AdminStats | null, currentUserEmail: string }) {
    const { data } = useSWR("/api/admin/management", (url) => fetch(url).then((res) => res.json()));
    const admins: Admin[] | undefined = data?.admins;
    const amIInitialAdmin = admins?.find((admin) => admin.email === currentUserEmail)?.added_by_email === null;

    if (!stats) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Skeleton className="h-[120px]" />
                    <Skeleton className="h-[120px]" />
                    <Skeleton className="h-[120px]" />
                    <Skeleton className="h-[120px]" />
                    <Skeleton className="h-[120px]" />
                </div>
                <Skeleton className="h-[400px]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <StatCard title="Total detections" value={stats.totalPlates} icon={Activity} />
                <StatCard title="Unique plates" value={stats.uniquePlates} icon={Fingerprint} />
                <StatCard title="Detections today" value={stats.detectionsToday} icon={Timer} />
                <StatCard title="Most common make" value={stats.mostCommonMake} icon={Car} />
                <StatCard title="Most common color" value={stats.mostCommonColor} icon={Palette} />
            </div>
            <DetectionsChart
                detectionsByHour={stats.detectionsByHour ?? []}
                detectionsByDay={stats.detectionsByDay ?? []}
            />
            <AdminManagement currentUserEmail={currentUserEmail} />
            {amIInitialAdmin && <AdminActivityLog />}
        </div>
    );
}
