// worker/src/video-capture.ts

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

import { spawn } from 'child_process';
import { writeFile, readdir, unlink, stat } from 'fs/promises';

const bufferPath = process.env.VIDEO_BUFFER_PATH!;
const finalCapturePath = process.env.VIDEO_FINAL_CAPTURE_PATH!;
const captureDuration = parseInt(process.env.VIDEO_CAPTURE_DURATION || '15', 10);
const PRE_EVENT_SECONDS = 10;
const POST_EVENT_SECONDS = 5;

const MINIMUM_FILE_SIZE_BYTES = 100 * 1024;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function generateThumbnail(videoPath: string): Promise<void> {
    return new Promise((resolve) => {
        const thumbnailPath = `${videoPath}.jpg`;
        const ffmpegArgs = ['-i', videoPath, '-ss', '00:00:01.000', '-vframes', '1', '-q:v', '2', thumbnailPath];

        console.log(`🖼️ Generating thumbnail for ${path.basename(videoPath)}`);
        const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

        ffmpegProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Thumbnail generated successfully: ${path.basename(thumbnailPath)}`);
            } else {
                console.error(`🔴 FFmpeg thumbnail generation exited with code ${code}`);
            }
            resolve();
        });
    });
}

export async function captureVideo(plate: string, eventTime: Date): Promise<string | null> {
    const finalFilename = `${plate}_${eventTime.toISOString().replace(/:/g, '-')}.mp4`;
    const finalOutputPath = path.join(finalCapturePath, finalFilename);

    console.log(`🎬 Initializing video capture for plate: ${plate}`);

    try {
        await delay(POST_EVENT_SECONDS * 1000 + 2000);
        const allSegments = await readdir(bufferPath);
        const relevantSegments = allSegments.filter(f => f.startsWith('segment_') && f.endsWith('.mp4')).sort();

        if (relevantSegments.length < 2) throw new Error('Not enough video segments in buffer.');

        const fileListContent = relevantSegments.map(f => `file '${path.join(bufferPath, f)}'`).join('\n');
        const listFilePath = path.join(bufferPath, 'templist.txt');
        await writeFile(listFilePath, fileListContent);

        console.log(`📋 Generated segment list for stitching.`);
        const eventTimestamp = eventTime.getTime();
        const startTimeMillis = eventTimestamp - (PRE_EVENT_SECONDS * 1000);
        const firstSegmentName = relevantSegments[0];
        const segmentTimestampStr = firstSegmentName.replace('segment_', '').replace('.mp4', '');
        const firstSegmentTime = parseInt(segmentTimestampStr, 10);
        const seekTime = (startTimeMillis - firstSegmentTime) / 1000;

        if (seekTime < 0) console.warn('⚠️ Warning: Event occurred too long ago, may not have full pre-roll buffer.');

        const finalSeekTime = Math.max(0, seekTime);

        // This promise will now resolve with either a filename (string) or null
        await new Promise<void>((resolve, reject) => {
            const ffmpegArgs = [ '-f', 'concat', '-safe', '0', '-i', listFilePath, '-ss', finalSeekTime.toString(), '-t', captureDuration.toString(), '-c', 'copy', finalOutputPath ];

            console.log(`🏃 Running FFmpeg stitch command for ${finalFilename}`);
            const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

            ffmpegProcess.on('close', async (code) => {
                await unlink(listFilePath).catch(err => console.error("Could not delete templist.txt", err));

                if (code === 0) {
                    try {
                        const stats = await stat(finalOutputPath);
                        console.log(`[${plate}] Video file created. Size: ${(stats.size / 1024).toFixed(1)} KB.`);
                        if (stats.size > MINIMUM_FILE_SIZE_BYTES) {
                            console.log(`[${plate}] ✅ Video size is valid. Proceeding with thumbnail.`);
                            await generateThumbnail(finalOutputPath);
                            resolve();
                        } else {
                            console.warn(`[${plate}] ⚠️ Video size is too small. Discarding corrupt file.`);
                            await unlink(finalOutputPath);
                            resolve();
                        }
                    } catch (statError) {
                        console.error(`[${plate}] 🔴 Could not check file stats for video.`, statError);
                        reject(statError);
                    }
                } else {
                    console.error(`🔴 FFmpeg stitch process exited with code ${code}`);
                    reject(new Error(`FFmpeg exited with code ${code}`));
                }
            });
        });

        try {
            await stat(finalOutputPath);
            return finalFilename;
        } catch {
            return null;
        }

    } catch (error) {
        console.error(`🔴 Fatal error during video capture process for ${plate}:`, error);
        return null;
    }
}