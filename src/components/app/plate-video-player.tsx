"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileVideo2, PlayCircle } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { PlateTag } from "./plate-format";

interface PlateVideoPlayerProps {
    videoUrl: string;
    plateNumber: string;
    appRegion: "UK" | "INTERNATIONAL";
    /**
     * Tile width. Has to be settable because the row's height is set by its
     * tallest cell, so leaving this fixed while the capture thumbnail shrinks
     * means compact density does nothing at all — measured at 62px in both
     * modes before this was threaded through.
     */
    tileClassName?: string;
}

export function PlateVideoPlayer({
    videoUrl,
    plateNumber,
    appRegion,
    tileClassName = "w-20",
}: PlateVideoPlayerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [thumbnailFailed, setThumbnailFailed] = useState(false);
    const videoSrc = `/api/videos/${videoUrl}`;
    const thumbnailSrc = `/api/videos/${videoUrl}.jpg`;

    /*
     * A row can reference a clip that was never written to disk. That is the
     * normal case for anything captured while the capture worker is down, and
     * the API correctly returns 404 for both the video and its thumbnail.
     *
     * Previously the img simply failed and the browser painted its own broken
     * image with the alt text spilling out of the cell, which reads as a
     * rendering bug rather than as missing footage. Worse, the tile still
     * looked clickable and opened a dialog onto a video that would never load.
     *
     * So a failed thumbnail renders as a labelled, non-interactive tile. It
     * says the clip is missing, which is true and useful, and it stops
     * offering an action that cannot succeed.
     */
    if (thumbnailFailed) {
        return (
            <div
                className={cn(
                    tileClassName,
                    "aspect-video rounded bg-muted border border-dashed flex flex-col items-center justify-center gap-0.5 text-muted-foreground",
                )}
                title={`No clip was recorded for ${plateNumber}`}
            >
                <FileVideo2 className="h-4 w-4" aria-hidden />
                <span className="text-[10px] leading-none">No clip</span>
            </div>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <button
                    className={cn(
                        tileClassName,
                        "aspect-video rounded overflow-hidden bg-muted border relative group cursor-pointer",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    )}
                    aria-label={`Play capture video for ${plateNumber}`}
                >
                    <Image
                        src={thumbnailSrc}
                        alt=""
                        fill
                        sizes="80px"
                        unoptimized
                        onError={() => setThumbnailFailed(true)}
                        className="object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlayCircle className="w-7 h-7 text-white/90" />
                    </div>
                </button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl p-0 border bg-background overflow-hidden">
                <DialogHeader className="px-4 py-3 bg-card border-b">
                    <DialogTitle>
                        <PlateTag plateNumber={plateNumber} appRegion={appRegion} />
                    </DialogTitle>
                </DialogHeader>
                {isOpen && (
                    <div className="aspect-video w-full bg-black">
                        <video key={videoUrl} src={videoSrc} controls autoPlay className="w-full h-full">
                            Your browser does not support the video tag.
                        </video>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
