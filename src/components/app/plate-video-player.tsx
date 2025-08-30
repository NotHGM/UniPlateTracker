// src/components/app/plate-video-player.tsx
"use client"

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlayCircle, Video } from "lucide-react";
import styles from "./plates.module.css";

interface PlateVideoPlayerProps {
    videoUrl: string;
    plateNumber: string;
    appRegion: 'UK' | 'INTERNATIONAL';
}

export function PlateVideoPlayer({ videoUrl, plateNumber, appRegion }: PlateVideoPlayerProps) {
    const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchThumbnail = async () => {
            try {
                const response = await fetch(`/api/videos/${videoUrl}?thumbnail=true`);
                if (!response.ok) throw new Error("Thumbnail fetch failed");

                const blob = await response.blob();
                if (isMounted) {
                    setThumbnailSrc(URL.createObjectURL(blob));
                }
            } catch (error) {
                console.error("Could not fetch video thumbnail:", error);
                if (isMounted) {
                    setThumbnailSrc(null);
                }
            }
        };

        fetchThumbnail();

        return () => {
            isMounted = false;
            if (thumbnailSrc) {
                URL.revokeObjectURL(thumbnailSrc);
            }
        };
    }, [videoUrl]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <div className="w-28 aspect-video rounded-md overflow-hidden bg-muted relative group cursor-pointer">
                    {thumbnailSrc ? (
                        <img src={thumbnailSrc} alt={`Thumbnail for ${plateNumber}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-6 h-6 text-muted-foreground animate-pulse" />
                        </div>
                    )}
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
                            src={`/api/videos/${videoUrl}`}
                            controls
                            autoPlay
                            className="w-full h-full rounded-b-lg"
                        />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}