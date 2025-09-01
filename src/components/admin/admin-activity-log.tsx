// src/components/admin/admin-activity-log.tsx
"use client";

import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface AdminActivityLog {
    id: number;
    timestamp: string;
    action_type: 'ADD_ADMIN' | 'REVOKE_ADMIN';
    target_email: string;
    actor_email: string;
}

class FetchError extends Error {
    info: unknown;
    status: number;
    constructor(message: string, info: unknown, status: number) {
        super(message);
        this.name = 'FetchError';
        this.info = info;
        this.status = status;
    }
}

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const errorInfo = await res.json();
        throw new FetchError('An error occurred while fetching the data.', errorInfo, res.status);
    }
    return res.json();
};

export function AdminActivityLog() {
    const { data: logs, error, isLoading } = useSWR<AdminActivityLog[]>('/api/admin/activity', fetcher, {
        revalidateOnFocus: false,
    });

    if (error instanceof FetchError && error.status === 403) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Admin Activity Log</CardTitle>
                <CardDescription>Recent administrative actions. Visible only to the initial admin.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[180px]">Timestamp</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Performed By</TableHead>
                                <TableHead>Target User</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
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
                            {logs && logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={log.action_type === 'REVOKE_ADMIN' ? 'destructive' : 'default'}>
                                            {log.action_type.replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{log.actor_email}</TableCell>
                                    <TableCell>{log.target_email}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}