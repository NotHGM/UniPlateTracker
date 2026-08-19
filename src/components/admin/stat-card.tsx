import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    /** Plain secondary text under the value — a comparison, a qualifier, or
     *  nothing. Deliberately not a coloured pill: a percentage badge shouts
     *  about a number that is usually unremarkable, and on a surveillance
     *  dashboard "traffic was slightly lower yesterday" is not news. */
    context?: string;
    /** Recent daily counts, oldest first. Drawn as a bare sparkline. */
    series?: number[];
    /** The one card that carries the headline number gets a tinted surface so
     *  the row has a focal point instead of five identical boxes. */
    emphasis?: boolean;
}

const formatValue = (v: string | number) =>
    typeof v === "number" ? new Intl.NumberFormat("en-GB").format(v) : v;

/**
 * A minimal sparkline, drawn as an SVG path rather than pulled from a chart
 * library. Recharts is already a dependency and is used for the real chart,
 * but a ResponsiveContainer per card for fourteen points is a lot of machinery
 * and layout work for a shape that is nine lines of arithmetic.
 *
 * Purely decorative in the accessibility sense: the number above it is the
 * information, and the trend is elaborated in the context line, so it is
 * hidden from assistive technology rather than described badly.
 */
function Sparkline({ points }: { points: number[] }) {
    if (points.length < 2) return null;

    const max = Math.max(...points);
    const min = Math.min(...points);
    // A flat series would divide by zero; drawing it down the middle is honest.
    const span = max - min || 1;

    const path = points
        .map((value, index) => {
            const x = (index / (points.length - 1)) * 100;
            const y = 100 - ((value - min) / span) * 100;
            return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");

    return (
        <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="w-full h-8 mt-2 text-muted-foreground/60"
            aria-hidden
            focusable="false"
        >
            <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function StatCard({ title, value, icon: Icon, context, series, emphasis }: StatCardProps) {
    return (
        <Card className={cn("p-4 gap-0", emphasis && "bg-secondary/50")}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{title}</span>
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
            </div>

            {/* Numbers are the point of this card, so they get the size and
                tabular figures; a string value stays smaller because a make or
                colour name at 30px would be shouting. */}
            <div
                className={cn(
                    "mt-1.5 font-semibold tracking-tight",
                    typeof value === "number" ? "text-2xl tabular-nums" : "text-lg truncate",
                )}
                title={typeof value === "string" ? value : undefined}
            >
                {formatValue(value)}
            </div>

            {context && <p className="text-xs text-muted-foreground mt-0.5">{context}</p>}
            {series && <Sparkline points={series} />}
        </Card>
    );
}
