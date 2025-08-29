// src/components/admin/dashboard-client.tsx
"use client"

import { useTheme } from 'next-themes';
import { Car, Palette, Timer, Fingerprint } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCard } from "./stat-card";
import styles from '@/app/admin/admindash.module.css';

const processHourlyData = (data: { hour: string; count: number }[]) => {
    const hourlyMap = new Map<string, number>();
    for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0');
        hourlyMap.set(`${hour}:00`, 0);
    }
    data.forEach(item => {
        const hourKey = item.hour.length === 2 ? `${item.hour}:00` : item.hour;
        hourlyMap.set(hourKey, item.count);
    });
    return Array.from(hourlyMap.entries())
        .map(([hour, count]) => ({ hour: hour.substring(0, 2), count }))
        .sort((a, b) => a.hour.localeCompare(b.hour));
};


export function DashboardClient({ stats }: { stats: any }) {
    const { theme } = useTheme();

    if (!stats) {
        return <p>Loading statistics...</p>;
    }

    const processedChartData = processHourlyData(stats.detectionsByHour);
    const primaryColor = `hsl(var(--primary))`;
    const foregroundColor = `hsl(var(--foreground))`;
    const mutedForegroundColor = `hsl(var(--muted-foreground))`;
    const borderColor = `hsl(var(--border))`;


    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <StatCard title="Total Detections" value={stats.totalPlates} icon={Car} />
                <StatCard title="Unique Plates" value={stats.uniquePlates} icon={Fingerprint} />
                <StatCard title="Detections Today" value={stats.detectionsToday} icon={Timer} />
                <StatCard title="Most Common Make" value={stats.mostCommonMake} icon={Car} />
                <StatCard title="Most Common Color" value={stats.mostCommonColor} icon={Palette} />
            </div>

            <Card className="col-span-1 lg:col-span-3">
                <CardHeader>
                    <CardTitle>Detections in the Last 24 Hours</CardTitle>
                </CardHeader>
                <CardContent className="h-[350px] w-full p-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={processedChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <defs>
                                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={primaryColor} stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0.2}/>
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="hour"
                                stroke={mutedForegroundColor}
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke={mutedForegroundColor}
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{ padding: '0px' }}
                                wrapperClassName={styles.chartTooltip}
                                labelClassName={styles.chartTooltipLabel}
                                formatter={(value) => [`${value} detections`, '']}
                                labelFormatter={(label) => `Hour: ${label}:00`}
                                cursor={{ fill: foregroundColor, opacity: 0.1 }}
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
        </div>
    )
}