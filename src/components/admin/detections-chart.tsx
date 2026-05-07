"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import dayjs from "dayjs";

type Range = "24h" | "7d" | "30d" | "90d" | "1y";

interface DetectionsChartProps {
    detectionsByHour: { hour: string; count: number }[];
    detectionsByDay: { day: string; count: number }[];
}

interface ChartPoint {
    label: string;
    fullLabel: string;
    count: number;
}

const formatNumber = (n: number) => new Intl.NumberFormat("en-GB").format(n);

const buildHourlySeries = (data: { hour: string; count: number }[]): ChartPoint[] => {
    const map = new Map<string, number>();
    for (let i = 0; i < 24; i++) map.set(i.toString().padStart(2, "0"), 0);
    data.forEach((item) => {
        if (item && typeof item.hour === "string") {
            const key = item.hour.substring(0, 2);
            if (map.has(key)) map.set(key, item.count);
        }
    });
    return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([h, count]) => ({ label: h, fullLabel: `${h}:00`, count }));
};

const buildDailySeries = (data: { day: string; count: number }[], days: number): ChartPoint[] => {
    const sliced = data.slice(-days);
    const compact = days <= 31;
    return sliced.map((d) => ({
        label: compact ? dayjs(d.day).format("DD MMM") : dayjs(d.day).format("DD/MM"),
        fullLabel: dayjs(d.day).format("ddd, DD MMM YYYY"),
        count: d.count,
    }));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const item = payload[0].payload as ChartPoint;
        const noun = item.count === 1 ? "detection" : "detections";
        return (
            <div className="px-3 py-2 text-sm bg-popover border rounded-md shadow-md">
                <div className="font-semibold">{`${formatNumber(item.count)} ${noun}`}</div>
                <div className="text-muted-foreground text-xs">{item.fullLabel}</div>
            </div>
        );
    }
    return null;
};

const RANGE_LABELS: Record<Range, string> = {
    "24h": "Last 24 hours, hourly",
    "7d": "Last 7 days, daily",
    "30d": "Last 30 days, daily",
    "90d": "Last 90 days, daily",
    "1y": "Last 12 months, daily",
};

export function DetectionsChart({ detectionsByHour, detectionsByDay }: DetectionsChartProps) {
    const [range, setRange] = useState<Range>("24h");

    const series = useMemo<ChartPoint[]>(() => {
        if (range === "24h") return buildHourlySeries(detectionsByHour);
        const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
        return buildDailySeries(detectionsByDay, days);
    }, [range, detectionsByHour, detectionsByDay]);

    const summary = useMemo(() => {
        const total = series.reduce((acc, p) => acc + p.count, 0);
        const peak = series.reduce<ChartPoint | null>((best, p) => (best && best.count >= p.count ? best : p), null);
        const avg = series.length > 0 ? Math.round(total / series.length) : 0;
        return { total, peak, avg };
    }, [series]);

    const tickInterval = useMemo(() => {
        if (range === "24h") return 2;
        if (range === "7d") return 0;
        if (range === "30d") return 4;
        if (range === "90d") return 9;
        return 29;
    }, [range]);

    const periodNoun = range === "24h" ? "hour" : "day";

    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 space-y-0">
                <div className="space-y-1">
                    <CardTitle>Detections over time</CardTitle>
                    <CardDescription>{RANGE_LABELS[range]}</CardDescription>
                </div>
                <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
                    <TabsList>
                        <TabsTrigger value="24h">24h</TabsTrigger>
                        <TabsTrigger value="7d">7d</TabsTrigger>
                        <TabsTrigger value="30d">30d</TabsTrigger>
                        <TabsTrigger value="90d">90d</TabsTrigger>
                        <TabsTrigger value="1y">1y</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid grid-cols-3 gap-4 sm:max-w-md">
                    <div>
                        <div className="text-xs text-muted-foreground">Total</div>
                        <div className="text-2xl font-bold tracking-tight">{formatNumber(summary.total)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Peak {periodNoun}</div>
                        <div className="text-2xl font-bold tracking-tight">
                            {summary.peak ? formatNumber(summary.peak.count) : "—"}
                        </div>
                        {summary.peak && summary.peak.count > 0 && (
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">{summary.peak.fullLabel}</div>
                        )}
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Avg / {periodNoun}</div>
                        <div className="text-2xl font-bold tracking-tight">{formatNumber(summary.avg)}</div>
                    </div>
                </div>

                <div className="-ml-2">
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={series} margin={{ top: 8, right: 16, left: -8, bottom: 4 }}>
                            <defs>
                                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis
                                dataKey="label"
                                stroke="var(--muted-foreground)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                interval={tickInterval}
                                minTickGap={12}
                            />
                            <YAxis
                                stroke="var(--muted-foreground)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                width={36}
                                allowDecimals={false}
                            />
                            <Tooltip
                                cursor={{ stroke: "var(--chart-1)", strokeOpacity: 0.4, strokeWidth: 1 }}
                                content={<ChartTooltip />}
                            />
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke="var(--chart-1)"
                                strokeWidth={2}
                                fill="url(#areaGradient)"
                                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
