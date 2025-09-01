// src/components/app/home-page-client.tsx
"use client";

import { useMemo } from "react";
import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import { PlatesTable } from "@/components/app/plates-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const fetcher = (url: string) => fetch(url).then(res => res.json());

type HomePageClientProps = {
    appRegion: 'UK' | 'INTERNATIONAL';
    internationalApiEnabled: boolean;
    videoCaptureEnabled: boolean;
};

export function HomePageClient({
                                   appRegion,
                                   internationalApiEnabled,
                                   videoCaptureEnabled
                               }: HomePageClientProps) {

    const searchParams = useSearchParams();

    const query = useMemo(() => {
        return searchParams.toString();
    }, [searchParams]);

    const { data: apiData, error: apiError } = useSWR(`/api/plates?${query}`, fetcher);

    if (apiError) {
        return <Alert variant="destructive"><AlertTitle>Error Loading Plates</AlertTitle><AlertDescription>{apiError.message}</AlertDescription></Alert>;
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
    return null;
}