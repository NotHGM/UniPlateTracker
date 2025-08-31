// src/components/app/plate-video-player.tsx
"use client"

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlayCircle } from "lucide-react";
import Image from "next/image";
import styles from "./plates.module.css";

interface PlateVideoPlayerProps {
    videoUrl: string;
    plateNumber: string;
    appRegion: 'UK' | 'INTERNATIONAL';
}

export function PlateVideoPlayer({ videoUrl, plateNumber, appRegion }: PlateVideoPlayerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const videoSrc = `/api/videos/${videoUrl}`;
    const thumbnailSrc = `/api/videos/${videoUrl}.jpg`;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <div className="w-28 aspect-video rounded-md overflow-hidden bg-muted relative group cursor-pointer">
                    <Image
                        src={thumbnailSrc}
                        alt={`Thumbnail for ${plateNumber}`}
                        fill
                        sizes="112px" // w-28 is 112px
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlayCircle className="w-8 h-8 text-white/90" />
                    </div>
                </div>
            </DialogTrigger>
            <DialogContent className="max-w-4xl p-0 border-0">
                <DialogHeader className="p-4 bg-card rounded-t-lg">
                    <DialogTitle>
                        <div className={appRegion === 'UK' ? styles.ukPlateStyle : styles.intlPlateStyle}>
                            <span>{plateNumber}</span>
                        </div>
                    </DialogTitle>
                </DialogHeader>
                {isOpen && (
                    <div className="aspect-video w-full bg-black">
                        <video
                            key={videoUrl}
                            src={videoSrc}
                            controls
                            autoPlay
                            className="w-full h-full rounded-b-lg"
                        >
                            Your browser does not support the video tag.
                        </video>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}