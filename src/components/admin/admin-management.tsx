"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserPlus, Trash2, ShieldOff, Loader2, Crown, FlaskConical } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Toaster, toast } from "sonner";

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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/*
 * isDemo is passed in rather than read from the environment, because this is
 * a client component and DEMO_MODE only exists on the server. Deliberately
 * not imported from lib/demo either: that module pulls in NextResponse, which
 * has no business in a browser bundle.
 */
export function AdminManagement({
    currentUserEmail,
    isDemo = false,
}: {
    currentUserEmail: string;
    isDemo?: boolean;
}) {
    const { data, error, mutate, isLoading } = useSWR<AdminData>("/api/admin/management", fetcher);
    const { admins, initialAdminEmail } = data || { admins: [], initialAdminEmail: null };

    const [newAdminEmail, setNewAdminEmail] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAdminEmail) return;
        setIsAdding(true);
        const promise = fetch("/api/admin/management", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: newAdminEmail }),
        }).then(async (res) => {
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to add admin");
            }
            return res.json();
        });
        toast.promise(promise, {
            loading: "Adding new admin...",
            success: (data) => { setNewAdminEmail(""); mutate(); return data.message; },
            error: (err) => err.message,
            finally: () => setIsAdding(false),
        });
    };

    const handleRevokeAdmin = async (emailToRevoke: string) => {
        const promise = fetch("/api/admin/management", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emailToRevoke }),
        }).then(async (res) => {
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to revoke admin");
            }
            return res.json();
        });
        toast.promise(promise, {
            loading: "Revoking access...",
            success: (data) => { mutate(); return data.message; },
            error: (err) => err.message,
        });
    };

    return (
        <Card>
            <Toaster richColors position="bottom-right" />
            <CardHeader>
                <CardTitle>Admin management</CardTitle>
                <CardDescription>Add, view and revoke admin user access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/*
                  * On the demo the form is replaced outright rather than
                  * disabled in place. A greyed-out field still reads as "you
                  * could do this if you were signed in properly", which is the
                  * wrong impression: the visitor IS signed in, and the answer
                  * is simply no. Saying so is clearer than a dead control.
                  */}
                {isDemo ? (
                    <Alert>
                        <FlaskConical className="h-4 w-4" aria-hidden />
                        <AlertTitle>Read-only demo</AlertTitle>
                        <AlertDescription>
                            Adding and revoking admins is disabled here, since the sign-in details for this demo
                            are public. Everything else on this dashboard behaves exactly as it does in a real
                            deployment.
                        </AlertDescription>
                    </Alert>
                ) : (
                <form onSubmit={handleAddAdmin} className="flex flex-col sm:flex-row gap-2">
                    {/*
                      * A real label, not just a placeholder. The placeholder
                      * disappears the moment you type, so the field loses its
                      * name exactly while it is being filled in — and this one
                      * grants administrative access, which is the last place to
                      * leave someone guessing what they are typing into.
                      */}
                    <label htmlFor="new-admin-email" className="sr-only">
                        Email address to grant admin access
                    </label>
                    <Input
                        id="new-admin-email"
                        type="email"
                        placeholder="new.admin@example.com"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        disabled={isAdding}
                        className="flex-1"
                    />
                    <Button type="submit" disabled={isAdding || !newAdminEmail}>
                        {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                        Add admin
                    </Button>
                </form>
                )}

                <div className="border rounded-md overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead className="hidden md:table-cell">Invited by</TableHead>
                                <TableHead className="hidden sm:table-cell">Date added</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            )}
                            {error && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-destructive">
                                        Could not load admin list.
                                    </TableCell>
                                </TableRow>
                            )}
                            {admins && admins.map((admin) => {
                                const isTargetInitialAdmin = admin.email === initialAdminEmail;
                                const myInviter = admins.find((a) => a.email === currentUserEmail)?.added_by_email;

                                let canRevoke = true;
                                let disabledTitle = "Revoke access";
                                if (isDemo) {
                                    canRevoke = false; disabledTitle = "Disabled in the demo.";
                                } else if (admin.email === currentUserEmail) {
                                    canRevoke = false; disabledTitle = "You cannot revoke yourself.";
                                } else if (isTargetInitialAdmin) {
                                    canRevoke = false; disabledTitle = "The initial admin cannot be revoked.";
                                } else if (admin.email === myInviter) {
                                    canRevoke = false; disabledTitle = "You cannot revoke your inviter.";
                                }

                                const invitedByText = admin.added_by_email
                                    ? admin.added_by_email
                                    : (isTargetInitialAdmin ? "Initial admin" : "Inviter revoked");

                                return (
                                    <TableRow key={admin.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span>{admin.email}</span>
                                                {admin.email === currentUserEmail && (
                                                    <Badge variant="secondary">You</Badge>
                                                )}
                                                {isTargetInitialAdmin && (
                                                    <Badge variant="warning" className="gap-1"><Crown className="h-3 w-3" /> Root</Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-muted-foreground">
                                            {invitedByText}
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                                            {new Date(admin.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" disabled={!canRevoke} title={disabledTitle}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Revoke admin access?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will permanently revoke access for <span className="font-semibold text-foreground">{admin.email}</span>.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleRevokeAdmin(admin.email)}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                            <ShieldOff className="mr-2 h-4 w-4" /> Yes, revoke
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
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
