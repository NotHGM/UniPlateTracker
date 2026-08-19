import Link from "next/link";
import { notFound } from "next/navigation";
import dayjs from "dayjs";
import { ArrowLeft } from "lucide-react";
import { getPlateHistory } from "@/lib/data";
import { PageHeader } from "@/components/shell/app-shell";
import { PlateTag, StatusBadge } from "@/components/app/plate-format";
import { PlateImage } from "@/components/app/plate-image";
import { PlateVideoPlayer } from "@/components/app/plate-video-player";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/** A labelled fact. Renders an em dash rather than nothing when unknown, so a
 *  missing value is visibly missing instead of looking like a layout bug. */
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium">{value ?? <span className="text-muted-foreground">—</span>}</dd>
        </div>
    );
}

export default async function PlateDetailPage({ params }: { params: Promise<{ plate: string }> }) {
    const { plate } = await params;
    const history = await getPlateHistory(decodeURIComponent(plate));

    if (!history) notFound();

    const appRegion = (process.env.APP_REGION || "UK") as "UK" | "INTERNATIONAL";
    const videoCaptureEnabled = process.env.ENABLE_VIDEO_CAPTURE === "true";
    const showVehicleDetails = appRegion === "UK" || process.env.ENABLE_INTERNATIONAL_API === "true";

    const { vehicle, firstSeen, lastSeen, seenAgain } = history;

    return (
        <>
            <PageHeader
                title="Vehicle"
                /*
                 * Says only what the schema knows. One row is kept per plate,
                 * carrying its first and most recent sighting, so a count of
                 * visits does not exist and claiming one would be inventing it.
                 */
                description={
                    seenAgain ? (
                        <>
                            Seen more than once, between {dayjs(firstSeen).format("D MMM YYYY")} and{" "}
                            {dayjs(lastSeen).format("D MMM YYYY")}
                        </>
                    ) : (
                        <>Seen once, on {dayjs(lastSeen).format("D MMM YYYY")}</>
                    )
                }
                actions={
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/">
                            <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden />
                            All detections
                        </Link>
                    </Button>
                }
            />

            <div className="space-y-4">
                <Card className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start gap-4">
                        <PlateTag plateNumber={vehicle.plate_number} appRegion={appRegion} className="text-lg" />
                        {showVehicleDetails && (
                            <div className="flex flex-wrap items-center gap-1.5">
                                <StatusBadge status={vehicle.mot_status} prefix="MOT" />
                                <StatusBadge status={vehicle.tax_status} />
                            </div>
                        )}
                    </div>

                    {showVehicleDetails && (
                        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-5">
                            <Fact label="Make" value={vehicle.car_make} />
                            <Fact label="Colour" value={vehicle.car_color} />
                            <Fact label="Fuel" value={vehicle.fuel_type} />
                            <Fact label="Year" value={vehicle.year_of_manufacture} />
                            <Fact
                                label="First registered"
                                value={
                                    vehicle.month_of_first_registration
                                        ? dayjs(vehicle.month_of_first_registration).format("MMM YYYY")
                                        : null
                                }
                            />
                            <Fact
                                label="MOT expires"
                                value={vehicle.mot_expiry_date ? dayjs(vehicle.mot_expiry_date).format("DD/MM/YYYY") : null}
                            />
                        </dl>
                    )}

                    {showVehicleDetails && (
                        <p className="text-xs text-muted-foreground mt-4">
                            Vehicle details reflect the most recent sighting. DVLA records change over time, so older
                            sightings may have carried different tax or MOT status.
                        </p>
                    )}
                </Card>

                {/*
                  * First and most recent, rather than a list of every sighting.
                  * The schema keeps one row per plate and overwrites
                  * recent_capture_time when it is seen again, so the sightings
                  * in between were never recorded. Listing the single row as
                  * though it were a history would have implied this vehicle was
                  * seen exactly once, which for 1,551 of the plates here is
                  * simply untrue.
                  */}
                <div>
                    <h2 className="text-sm font-medium mb-2">Sighting record</h2>

                    <Card className="p-0 overflow-hidden">
                        <ul className="divide-y">
                            <li className="flex items-center gap-3 p-3">
                                <PlateImage
                                    imageUrl={vehicle.image_url}
                                    plateNumber={vehicle.plate_number}
                                    appRegion={appRegion}
                                    capturedAt={lastSeen}
                                    className="w-24 shrink-0"
                                />

                                <div className="min-w-0 flex-1">
                                    <p className="text-xs text-muted-foreground">Most recent sighting</p>
                                    <time
                                        dateTime={new Date(lastSeen).toISOString()}
                                        className="text-sm font-medium"
                                    >
                                        {dayjs(lastSeen).format("D MMM YYYY, HH:mm")} ·{" "}
                                        {dayjs(lastSeen).format("dddd")}
                                    </time>
                                </div>

                                {videoCaptureEnabled && vehicle.video_url && (
                                    <PlateVideoPlayer
                                        videoUrl={vehicle.video_url}
                                        plateNumber={vehicle.plate_number}
                                        appRegion={appRegion}
                                    />
                                )}
                            </li>

                            <li className="p-3">
                                <p className="text-xs text-muted-foreground">First sighting</p>
                                <time
                                    dateTime={new Date(firstSeen).toISOString()}
                                    className="text-sm font-medium"
                                >
                                    {dayjs(firstSeen).format("D MMM YYYY, HH:mm")} ·{" "}
                                    {dayjs(firstSeen).format("dddd")}
                                </time>
                            </li>
                        </ul>
                    </Card>

                    <p className="text-xs text-muted-foreground mt-2">
                        Only the first and most recent sighting are kept. Individual visits in between are not
                        recorded, so this is not a count of how often the vehicle has passed the camera.
                    </p>
                </div>
            </div>
        </>
    );
}
