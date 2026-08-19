"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { ImageOff, Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PlateTag } from "./plate-format";

/**
 * The capture thumbnail, enlargeable.
 *
 * The thumbnail in a row is 80px wide, which is enough to tell one vehicle
 * from another and nowhere near enough to actually look at the vehicle. That
 * is the whole reason someone opens this application — to see what was
 * outside — so the image needs a way to be viewed properly.
 *
 * Deliberately mirrors PlateVideoPlayer: same dialog, same header treatment,
 * same hover affordance. Two media types in the same row that behave
 * differently when clicked would be a small cruelty.
 */
export function PlateImage({
    imageUrl,
    plateNumber,
    appRegion,
    capturedAt,
    className,
}: {
    imageUrl: string | null;
    plateNumber: string | null;
    appRegion: "UK" | "INTERNATIONAL";
    capturedAt?: string | null;
    className?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);

    const frameClass = cn("aspect-video rounded overflow-hidden bg-muted border", className);

    // Nothing to enlarge, so nothing is offered. A button that opens an empty
    // dialog is worse than no button.
    if (!imageUrl) {
        return (
            <div className={cn(frameClass, "flex items-center justify-center text-muted-foreground")}>
                <ImageOff className="h-4 w-4" aria-hidden />
                <span className="sr-only">No capture image</span>
            </div>
        );
    }

    const label = capturedAt
        ? `Enlarge capture of ${plateNumber ?? "vehicle"}, ${dayjs(capturedAt).format("D MMM YYYY HH:mm")}`
        : `Enlarge capture of ${plateNumber ?? "vehicle"}`;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {/*
              * Not DialogTrigger asChild, because this button lives inside a
              * table row and Radix's trigger would take over its focus
              * handling. Controlling open state directly keeps the row's
              * keyboard order intact.
              */}
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                aria-label={label}
                className={cn(
                    frameClass,
                    "relative group cursor-zoom-in",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                )}
            >
                {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URI from the capture, not a remote asset */}
                <img
                    src={imageUrl}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-150 motion-safe:group-hover:scale-105"
                />
                <span className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150">
                    <Maximize2 className="w-4 h-4 text-white" aria-hidden />
                </span>
            </button>

            {/*
              * Sized to the image rather than to a fixed width.
              *
              * UniFi's event thumbnails are small and square — 360x360 on this
              * camera — so a fixed wide dialog letterboxed them between black
              * bars and made the picture look like a mistake. Letting the
              * dialog take the image's shape means the frame is always full,
              * whatever aspect ratio the camera happens to produce.
              */}
            {/*
              * sm:max-w is needed as well as max-w. DialogContent ships a
              * sm:max-w-lg of its own, and a utility inside a media query
              * outranks a plain one in the cascade regardless of order, so
              * without the breakpoint variant here the dialog silently caps
              * itself at 512px and the image never reaches its intended size.
              */}
            <DialogContent className="w-auto max-w-[95vw] sm:max-w-[min(672px,95vw)] p-0 border bg-background overflow-hidden">
                <DialogHeader className="px-4 py-3 bg-card border-b">
                    <DialogTitle className="flex flex-wrap items-center gap-3">
                        <PlateTag plateNumber={plateNumber} appRegion={appRegion} />
                        {capturedAt && (
                            <time
                                dateTime={new Date(capturedAt).toISOString()}
                                className="text-sm font-normal text-muted-foreground tabular-nums"
                            >
                                {dayjs(capturedAt).format("D MMM YYYY, HH:mm")}
                            </time>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {/*
                 * Rendered only while open. These are base64 data URIs held in
                 * the row, so mounting every dialog on the page would put a
                 * full copy of ten images into the DOM before anyone asked for
                 * one.
                 *
                 * contain rather than cover: this is the whole point of the
                 * dialog, and cropping the image someone opened specifically
                 * to look at would defeat it.
                 */}
                {isOpen && (
                    <div className="bg-muted flex items-center justify-center">
                        {/*
                         * Scaled up to 640px, then stopped.
                         *
                         * UniFi's event thumbnails are around 360px, so this is
                         * an upscale and it is the right trade: the row
                         * thumbnail is 80px, and being able to actually make
                         * out the vehicle beats pixel purity on a surveillance
                         * tool. The cap exists because past roughly 2x there is
                         * no detail left to reveal — stretching it across a 4K
                         * display would only magnify compression artefacts and
                         * make the picture look worse than it is.
                         */}
                        {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URI from the capture */}
                        <img
                            src={imageUrl}
                            alt={`Camera capture of ${plateNumber ?? "vehicle"}`}
                            /*
                             * A definite width, not w-full. The dialog is
                             * w-auto so it sizes to its content, which makes
                             * a percentage width circular — the image asks the
                             * parent how wide it is while the parent is asking
                             * the image. Stating the width outright settles it.
                             */
                            className="w-[min(640px,95vw)] h-auto max-h-[75vh] object-contain"
                        />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
