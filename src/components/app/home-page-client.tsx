"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { PlatesTable } from "@/components/app/plates-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = async (url: string) => {
    const res = await fetch(url);
    const text = await res.text();
    let data: any = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = null;
        }
    }

    if (!res.ok) {
        throw new Error(data?.error || data?.message || "Failed to load dashboard data.");
    }

    if (!data) {
        throw new Error("Received an empty response from the server.");
    }

    return data;
};

type HomePageClientProps = {
    appRegion: "UK" | "INTERNATIONAL";
    internationalApiEnabled: boolean;
    videoCaptureEnabled: boolean;
};

export function HomePageClient({
    appRegion,
    internationalApiEnabled,
    videoCaptureEnabled,
}: HomePageClientProps) {
    const searchParams = useSearchParams();

    const query = useMemo(() => searchParams.toString(), [searchParams]);

    const { data: apiData, error: apiError } = useSWR(`/api/plates?${query}`, fetcher);

    if (apiError) {
        return (
            <Alert variant="destructive">
                <AlertTitle>Error loading plates</AlertTitle>
                <AlertDescription>{apiError.message}</AlertDescription>
            </Alert>
        );
    }

    if (apiData) {
        return (
            <PlatesTable
                initialApiData={apiData}
                error={apiData?.error}
                appRegion={appRegion}
                internationalApiEnabled={internationalApiEnabled}
                videoCaptureEnabled={videoCaptureEnabled}
            />
        );
    }

    return (
        <div className="space-y-4">
            <Skeleton className="h-[140px] w-full" />
            <Skeleton className="h-[600px] w-full" />
        </div>
    );
}
