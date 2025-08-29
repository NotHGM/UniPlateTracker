// src/app/admin/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DashboardClient } from "@/components/admin/dashboard-client";
import { ModeToggle } from "@/components/mode-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LogoutButton } from "@/components/admin/logout-button";

async function getStatsData() {
    const baseUrl = process.env.NEXTAUTH_URL;
    if (!baseUrl) {
        return { error: "Configuration error: NEXTAUTH_URL is not set." };
    }

    try {
        const response = await fetch(`${baseUrl}/api/admin/stats`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`API responded with ${response.status}`);
        const data = await response.json();
        return { data };
    } catch (error) {
        console.error("Failed to fetch stats:", error);
        return { error: "Could not connect to the API service." };
    }
}

export default async function AdminDashboardPage() {
    const session = await getSession();

    if (!session.user) {
        redirect("/admin/auth");
    }
    const { data, error } = await getStatsData();

    return (
        <div className="bg-muted/40 min-h-screen">
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                        <p className="text-muted-foreground">
                            Welcome back, {session.user.email}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <ModeToggle />
                        <LogoutButton />
                    </div>
                </div>
                {error ? (
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : (
                    <DashboardClient stats={data} />
                )}
            </main>
        </div>
    );
}