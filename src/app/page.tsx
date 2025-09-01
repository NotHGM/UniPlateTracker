// src/app/page.tsx

import { Suspense } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { AdminButton } from "@/components/admin-button";
import { HomePageClient } from "@/components/app/home-page-client";
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
  const appRegion = process.env.APP_REGION || 'UK';
  const internationalApiEnabled = process.env.ENABLE_INTERNATIONAL_API === 'true';
  const videoCaptureEnabled = process.env.ENABLE_VIDEO_CAPTURE === 'true';

  return (
      <div className="bg-background min-h-screen">
        <main className="container mx-auto p-4 sm:p-6 lg:p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">UniPlateTracker</h1>
              <p className="text-muted-foreground">
                A centralized dashboard for license plate monitoring.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AdminButton />
              <ModeToggle />
            </div>
          </div>
          <Suspense fallback={<DashboardSkeleton />}>
            <HomePageClient
                appRegion={appRegion as 'UK' | 'INTERNATIONAL'}
                internationalApiEnabled={internationalApiEnabled}
                videoCaptureEnabled={videoCaptureEnabled}
            />
          </Suspense>
        </main>
      </div>
  );
}