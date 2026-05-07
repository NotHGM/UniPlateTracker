import Link from "next/link";
import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { DashboardClient } from "@/components/admin/dashboard-client";
import { ModeToggle } from "@/components/mode-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LogoutButton } from "@/components/admin/logout-button";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getAdminStats } from "@/lib/data";

export default async function AdminDashboardPage() {
    // @ts-ignore
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.user) redirect("/admin/auth");

    let data = null;
    let error: string | null = null;
    try {
        data = await getAdminStats();
    } catch (e: unknown) {
        error = e instanceof Error ? e.message : "Could not connect to data service.";
    }

    return (
        <div className="bg-background min-h-screen">
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex justify-between items-start gap-4 mb-6 flex-wrap">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">Admin dashboard</h1>
                        <p className="text-muted-foreground">Welcome back, {session.user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" asChild title="Back to dashboard">
                            <Link href="/" aria-label="Back to dashboard">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <ModeToggle />
                        <LogoutButton />
                    </div>
                </div>
                {error ? (
                    <Alert variant="destructive">
                        <AlertTitle>Error loading dashboard</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : (
                    <DashboardClient stats={data} currentUserEmail={session.user.email} />
                )}
            </main>
        </div>
    );
}
