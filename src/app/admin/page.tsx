// src/app/admin/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { DashboardClient } from '@/components/admin/dashboard-client';
import { ModeToggle } from '@/components/mode-toggle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LogoutButton } from '@/components/admin/logout-button';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

async function getStatsData() {
    const baseUrl = process.env.NEXTAUTH_URL;
    if (!baseUrl) {
        console.error("Configuration error: NEXTAUTH_URL is not set.");
        return { error: "Server configuration is incomplete." };
    }

    try {
        const response = await fetch(`${baseUrl}/api/admin/stats`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`API responded with ${response.status}`);
        return { data: await response.json() };
    } catch (error) {
        console.error("Failed to fetch stats:", error);
        return { error: "Could not connect to the statistics API." };
    }
}

export default async function AdminDashboardPage() {
    // @ts-ignore
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    if (!session.user) {
        redirect("/admin/auth");
    }

    const { data, error } = await getStatsData();

    return (
        <div className="bg-background min-h-screen">
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                        <p className="text-muted-foreground">
                            Welcome back, {session.user.email}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" asChild>
                            <Link href="/"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        <ModeToggle />
                        <LogoutButton />
                    </div>
                </div>
                {error ? (
                    <Alert variant="destructive">
                        <AlertTitle>Error Loading Dashboard</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : (
                    <DashboardClient stats={data} currentUserEmail={session.user.email} />
                )}
            </main>
        </div>
    );
}