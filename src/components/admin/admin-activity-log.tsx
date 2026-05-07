"use client";

import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, ShieldOff } from "lucide-react";

interface AdminActivityLog {
    id: number;
    timestamp: string;
    action_type: "ADD_ADMIN" | "REVOKE_ADMIN";
    target_email: string;
    actor_email: string;
}

class FetchError extends Error {
    info: unknown;
    status: number;
    constructor(message: string, info: unknown, status: number) {
        super(message);
        this.name = "FetchError";
        this.info = info;
        this.status = status;
    }
}

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const errorInfo = await res.json();
        throw new FetchError("An error occurred while fetching the data.", errorInfo, res.status);
    }
    return res.json();
};

export function AdminActivityLog() {
    const { data: logs, error, isLoading } = useSWR<AdminActivityLog[]>("/api/admin/activity", fetcher, {
        revalidateOnFocus: false,
    });

    if (error instanceof FetchError && error.status === 403) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Admin activity log</CardTitle>
                <CardDescription>Recent administrative actions. Visible only to the initial admin.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[180px]">Timestamp</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead className="hidden md:table-cell">Performed by</TableHead>
                                <TableHead>Target</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            )}
                            {error && !isLoading && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-destructive">
                                        Could not load activity log.
                                    </TableCell>
                                </TableRow>
                            )}
                            {logs && logs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                                        No activity recorded yet.
                                    </TableCell>
                                </TableRow>
                            )}
                            {logs && logs.map((log) => {
                                const isRevoke = log.action_type === "REVOKE_ADMIN";
                                return (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(log.timestamp).toLocaleString("en-GB", {
                                                day: "2-digit", month: "short", year: "numeric",
                                                hour: "2-digit", minute: "2-digit",
                                            })}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={isRevoke ? "destructive" : "success"} className="gap-1">
                                                {isRevoke ? <ShieldOff className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                                {log.action_type.replace("_", " ")}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-muted-foreground">{log.actor_email}</TableCell>
                                        <TableCell>{log.target_email}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
