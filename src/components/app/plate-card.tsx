"use client";

import dayjs from "dayjs";
import { ImageOff } from "lucide-react";
import { LicensePlate } from "@/lib/types";
import { PlateTag, StatusBadge } from "./plate-format";
import { PlateVideoPlayer } from "./plate-video-player";

/**
 * A single detection, shaped for a narrow viewport.
 *
 * The table this replaces below the md breakpoint carries eight columns. On
 * a 390px screen that did not scroll, it clipped: vehicle text truncated
 * mid-word and the MOT, tax, registration, video and last-seen columns were
 * unreachable entirely, so the phone view could not answer the question the
 * application exists to answer.
 *
 * Reflowing into a card rather than allowing horizontal scroll is the right
 * trade here because the columns are not peers. The plate and when it was
 * seen are what someone scans for; everything else is detail they read once
 * they have found the row. A scrolling table gives every column equal weight
 * and hides the important ones off-screen just as readily as the rest.
 */
export function PlateCard({
    plate,
    appRegion,
    showVehicleDetails,
    videoCaptureEnabled,
}: {
    plate: LicensePlate;
    appRegion: "UK" | "INTERNATIONAL";
    showVehicleDetails: boolean;
    videoCaptureEnabled: boolean;
}) {
    const seenAt = dayjs(plate.recent_capture_time);

    const vehicleLine = [plate.car_make, plate.car_color, plate.fuel_type].filter(Boolean).join(" · ");
    const registrationLine = [
        plate.year_of_manufacture,
        plate.month_of_first_registration
            ? `registered ${dayjs(plate.month_of_first_registration).format("MMM YYYY")}`
            : null,
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <li className="border-b last:border-b-0 p-3">
            <div className="flex gap-3">
                <div className="w-24 shrink-0 aspect-video rounded-md overflow-hidden bg-muted border">
                    {plate.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- base64 data URI from the capture, not a remote asset
                        <img
                            src={plate.image_url}
                            alt={`Capture of ${plate.plate_number}`}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <ImageOff className="h-4 w-4" aria-hidden />
                            <span className="sr-only">No capture image</span>
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                        <PlateTag plateNumber={plate.plate_number} appRegion={appRegion} />
                        <time
                            dateTime={seenAt.toISOString()}
                            title={seenAt.format("DD/MM/YYYY HH:mm")}
                            className="text-xs text-muted-foreground whitespace-nowrap pt-1 tabular-nums"
                        >
                            {seenAt.fromNow()}
                        </time>
                    </div>

                    {showVehicleDetails && (
                        <>
                            {vehicleLine && <p className="text-sm font-medium truncate">{vehicleLine}</p>}
                            {registrationLine && (
                                <p className="text-xs text-muted-foreground tabular-nums">{registrationLine}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                <StatusBadge status={plate.mot_status} prefix="MOT" />
                                <StatusBadge status={plate.tax_status} />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {videoCaptureEnabled && plate.video_url && (
                <div className="mt-2 pl-[6.75rem]">
                    <PlateVideoPlayer
                        videoUrl={plate.video_url}
                        plateNumber={plate.plate_number}
                        appRegion={appRegion}
                    />
                </div>
            )}
        </li>
    );
}
