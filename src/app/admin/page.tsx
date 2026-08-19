import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { DashboardClient } from "@/components/admin/dashboard-client";
import { PageHeader } from "@/components/shell/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
        <>
            <PageHeader title="Admin" description={`Signed in as ${session.user.email}`} />
            {error ? (
                <Alert variant="destructive">
                    <AlertTitle>Error loading dashboard</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : (
                <DashboardClient stats={data} currentUserEmail={session.user.email} />
            )}
        </>
    );
}
