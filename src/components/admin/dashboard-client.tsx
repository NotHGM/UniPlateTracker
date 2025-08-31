"use client"

import { Car, Palette, Timer, Fingerprint } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "./stat-card";
import { AdminManagement } from "./admin-management";
import { Bar, BarChart, ResponsiveContainer, XAxis, Tooltip, CartesianGrid } from 'recharts';

interface HourlyData {
    name: string;
    count: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const count = payload[0].value;
        const detectionText = count === 1 ? 'detection' : 'detections';
        return (
            <div className="p-2 text-sm bg-background/90 backdrop-blur-sm border rounded-lg shadow-lg">
                <p className="font-bold">{`${count} ${detectionText}`}</p>
                <p className="text-muted-foreground">{`Hour: ${label}:00`}</p>
            </div>
        );
    }
    return null;
};

const DetectionsChart = ({ data }: { data: HourlyData[] }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Detections in the Last 24 Hours</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <defs>
                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted) / 0.5)" />
                        <XAxis
                            dataKey="name"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'hsl(var(--muted) / 0.3)', radius: 4 }}
                            content={<CustomTooltip />}
                        />
                        <Bar
                            dataKey="count"
                            fill="url(#barGradient)"
                            radius={[4, 4, 0, 0]}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

export function DashboardClient({ stats, currentUserEmail }: { stats: any, currentUserEmail: string }) {

    if (!stats) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Skeleton className="h-[126px]" />
                    <Skeleton className="h-[126px]" />
                    <Skeleton className="h-[126px]" />
                    <Skeleton className="h-[126px]" />
                    <Skeleton className="h-[126px]" />
                </div>
                <Skeleton className="h-[400px]" />
            </div>
        );
    }

    const processHourlyData = (data: { hour: string; count: number }[] | undefined) => {
        const hourlyMap = new Map<string, number>();
        for (let i = 0; i < 24; i++) {
            const hour = i.toString().padStart(2, '0');
            hourlyMap.set(hour, 0);
        }

        if (data && Array.isArray(data)) {
            data.forEach(item => {
                if (item && typeof item.hour === 'string') {
                    const hourKey = item.hour.substring(0, 2);
                    if (hourlyMap.has(hourKey)) {
                        hourlyMap.set(hourKey, item.count);
                    }
                }
            });
        }

        return Array.from(hourlyMap.entries())
            .map(([hour, count]) => ({ name: hour, count: count })) // Convert 'hour' to 'name' for the chart
            .sort((a, b) => a.name.localeCompare(b.name));
    };

    const processedChartData = processHourlyData(stats.detectionsByHour);

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <StatCard title="Total Detections" value={stats.totalPlates} icon={Car} />
                <StatCard title="Unique Plates" value={stats.uniquePlates} icon={Fingerprint} />
                <StatCard title="Detections Today" value={stats.detectionsToday} icon={Timer} />
                <StatCard title="Most Common Make" value={stats.mostCommonMake} icon={Car} />
                <StatCard title="Most Common Color" value={stats.mostCommonColor} icon={Palette} />
            </div>

            <DetectionsChart data={processedChartData} />

            <AdminManagement currentUserEmail={currentUserEmail} />
        </div>
    )
}