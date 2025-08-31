// src/components/admin/admin-management.tsx
"use client";

import { useState } from "react";
import useSWR from 'swr';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserPlus, Trash2, ShieldOff, Loader2 } from 'lucide-react';
import { Toaster, toast } from 'sonner';

interface AdminUser {
    id: number;
    email: string;
    created_at: string;
    added_by_email: string | null;
}

interface AdminData {
    admins: AdminUser[];
    initialAdminEmail: string | null;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function AdminManagement({ currentUserEmail }: { currentUserEmail: string }) {
    const { data, error, mutate, isLoading } = useSWR<AdminData>('/api/admin/management', fetcher);
    const { admins, initialAdminEmail } = data || { admins: [], initialAdminEmail: null };

    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    // handleAddAdmin and handleRevokeAdmin functions are unchanged.
    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAdminEmail) return;
        setIsAdding(true);
        const promise = fetch('/api/admin/management', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: newAdminEmail }),
        }).then(async (res) => {
            if (!res.ok) { const errorData = await res.json(); throw new Error(errorData.error || 'Failed to add admin'); }
            return res.json();
        });
        toast.promise(promise, { loading: 'Adding new admin...', success: (data) => { setNewAdminEmail(''); mutate(); return data.message; }, error: (err) => err.message, finally: () => setIsAdding(false) });
    };

    const handleRevokeAdmin = async (emailToRevoke: string) => {
        const promise = fetch('/api/admin/management', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailToRevoke }),
        }).then(async (res) => {
            if (!res.ok) { const errorData = await res.json(); throw new Error(errorData.error || 'Failed to revoke admin'); }
            return res.json();
        });
        toast.promise(promise, { loading: 'Revoking access...', success: (data) => { mutate(); return data.message; }, error: (err) => err.message });
    };

    return (
        <Card>
            <Toaster richColors position="bottom-right" />
            <CardHeader>
                <CardTitle>Admin Management</CardTitle>
                <CardDescription>Add, view, and revoke admin user access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <form onSubmit={handleAddAdmin} className="flex gap-2">
                    <Input type="email" placeholder="new.admin@example.com" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} disabled={isAdding} />
                    <Button type="submit" disabled={isAdding || !newAdminEmail}>
                        {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                        Add Admin
                    </Button>
                </form>

                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Invited By</TableHead>
                                <TableHead>Date Added</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (<TableRow><TableCell colSpan={4} className="h-24 text-center">Loading admins...</TableCell></TableRow>)}
                            {error && (<TableRow><TableCell colSpan={4} className="h-24 text-center text-destructive">Could not load admin list.</TableCell></TableRow>)}
                            {admins && admins.map((admin) => {
                                const isTargetInitialAdmin = admin.email === initialAdminEmail;
                                const myInviter = admins.find(a => a.email === currentUserEmail)?.added_by_email;

                                let canRevoke = true;
                                let disabledTitle = "Revoke access";

                                if (admin.email === currentUserEmail) {
                                    canRevoke = false; disabledTitle = "You cannot revoke yourself.";
                                } else if (isTargetInitialAdmin) {
                                    canRevoke = false; disabledTitle = "The initial admin cannot be revoked.";
                                } else if (admin.email === myInviter) {
                                    canRevoke = false; disabledTitle = "You cannot revoke your inviter.";
                                }

                                const invitedByText = admin.added_by_email ? admin.added_by_email : (isTargetInitialAdmin ? 'Initial Admin' : 'Inviter Revoked');

                                return (
                                    <TableRow key={admin.id}>
                                        <TableCell className="font-medium">{admin.email}{admin.email === currentUserEmail && " (You)"}</TableCell>
                                        <TableCell>{invitedByText}</TableCell>
                                        <TableCell>{new Date(admin.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" disabled={!canRevoke} title={disabledTitle}><Trash2 className="h-4 w-4" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently revoke access for <span className="font-bold">{admin.email}</span>.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleRevokeAdmin(admin.email)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90"><ShieldOff className="mr-2 h-4 w-4" /> Yes, Revoke</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                )})}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}