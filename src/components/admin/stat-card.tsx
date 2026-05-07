import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
}

const formatValue = (v: string | number) =>
    typeof v === "number" ? new Intl.NumberFormat("en-GB").format(v) : v;

export function StatCard({ title, value, icon: Icon }: StatCardProps) {
    return (
        <Card className="gap-2 py-5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight">{formatValue(value)}</div>
            </CardContent>
        </Card>
    );
}
