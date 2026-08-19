import Link from "next/link";
import { notFound } from "next/navigation";
import dayjs from "dayjs";
import { ArrowLeft, ImageOff } from "lucide-react";
import { getPlateHistory } from "@/lib/data";
import { PageHeader } from "@/components/shell/app-shell";
import { PlateTag, StatusBadge } from "@/components/app/plate-format";
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

    const { vehicle, sightings, firstSeen, lastSeen, totalSightings } = history;

    return (
        <>
            <PageHeader
                title="Vehicle"
                /*
                 * A single sighting, or several on one day, has no range to
                 * describe — "between 19 Aug and 19 Aug" reads like a bug.
                 */
                description={
                    totalSightings === 1 ? (
                        <>Seen once, on {dayjs(lastSeen).format("D MMM YYYY")}</>
                    ) : dayjs(firstSeen).isSame(dayjs(lastSeen), "day") ? (
                        <>
                            Seen <span className="tabular-nums font-medium">{totalSightings}</span> times on{" "}
                            {dayjs(lastSeen).format("D MMM YYYY")}
                        </>
                    ) : (
                        <>
                            Seen{" "}
                            <span className="tabular-nums font-medium">
                                {totalSightings.toLocaleString("en-GB")}
                            </span>{" "}
                            times between {dayjs(firstSeen).format("D MMM YYYY")} and{" "}
                            {dayjs(lastSeen).format("D MMM YYYY")}
                        </>
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

                <div>
                    <h2 className="text-sm font-medium mb-2">
                        Sightings <span className="text-muted-foreground tabular-nums">({totalSightings})</span>
                    </h2>

                    <Card className="p-0 overflow-hidden">
                        <ul className="divide-y">
                            {sightings.map((sighting) => (
                                <li key={sighting.id} className="flex items-center gap-3 p-3">
                                    <div className="w-24 shrink-0 aspect-video rounded overflow-hidden bg-muted border">
                                        {sighting.image_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element -- base64 data URI from the capture
                                            <img
                                                src={sighting.image_url}
                                                alt={`Capture at ${dayjs(sighting.recent_capture_time).format("DD/MM/YYYY HH:mm")}`}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                <ImageOff className="h-4 w-4" aria-hidden />
                                            </div>
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <time
                                            dateTime={new Date(sighting.recent_capture_time).toISOString()}
                                            className="text-sm font-medium"
                                        >
                                            {dayjs(sighting.recent_capture_time).format("D MMM YYYY, HH:mm")}
                                        </time>
                                        <p className="text-xs text-muted-foreground">
                                            {dayjs(sighting.recent_capture_time).format("dddd")}
                                        </p>
                                    </div>

                                    {videoCaptureEnabled && sighting.video_url && (
                                        <PlateVideoPlayer
                                            videoUrl={sighting.video_url}
                                            plateNumber={sighting.plate_number}
                                            appRegion={appRegion}
                                        />
                                    )}
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>
            </div>
        </>
    );
}
