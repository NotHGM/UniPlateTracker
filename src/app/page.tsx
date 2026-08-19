import { Suspense } from "react";
import { HomePageClient } from "@/components/app/home-page-client";
import { PageHeader } from "@/components/shell/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

function DashboardSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-[140px] w-full" />
            <Skeleton className="h-[600px] w-full" />
        </div>
    );
}

export default function HomePage() {
    const appRegion = (process.env.APP_REGION || "UK") as "UK" | "INTERNATIONAL";
    const internationalApiEnabled = process.env.ENABLE_INTERNATIONAL_API === "true";
    const videoCaptureEnabled = process.env.ENABLE_VIDEO_CAPTURE === "true";

    return (
        <>
            <PageHeader
                title="Detections"
                description="Every plate seen by your cameras, newest first."
            />
            <Suspense fallback={<DashboardSkeleton />}>
                <HomePageClient
                    appRegion={appRegion}
                    internationalApiEnabled={internationalApiEnabled}
                    videoCaptureEnabled={videoCaptureEnabled}
                />
            </Suspense>
        </>
    );
}
