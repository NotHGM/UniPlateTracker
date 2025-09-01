// worker/src/buffer-manager.ts

import { spawn } from 'child_process';
import { readdir, unlink, stat } from 'fs/promises';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const rtspUrl: string | undefined = process.env.RTSP_URL;
const bufferPath: string | undefined = process.env.VIDEO_BUFFER_PATH;

const segmentDuration = parseInt(process.env.VIDEO_SEGMENT_DURATION || '30', 10);
const bufferRetentionMinutes = parseInt(process.env.VIDEO_BUFFER_RETENTION_MINUTES || '5', 10);
const cleanupInterval = segmentDuration * 1000;

function createSegment(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!rtspUrl || !bufferPath) {
            console.error('🔴 Critical Error: Environment variables are not available in createSegment.');
            return reject(new Error("RTSP_URL or VIDEO_BUFFER_PATH is not defined."));
        }

        const timestamp = Date.now();
        const filename = `segment_${timestamp}.mp4`;
        const outputPath = path.join(bufferPath, filename);

        console.log(`🎥 [${new Date().toLocaleTimeString()}] Starting new segment: ${filename}`);

        const ffmpegArgs = [
            '-rtsp_transport', 'tcp',
            '-i', rtspUrl,
            '-t', segmentDuration.toString(),
            '-c', 'copy',
            '-map', '0',
            outputPath
        ];

        const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

        const killTimeout = setTimeout(() => {
            console.warn(`⚠️ FFmpeg process for ${filename} took too long, killing.`);
            ffmpegProcess.kill('SIGINT');
            resolve();
        }, (segmentDuration + 15) * 1000);

        ffmpegProcess.stderr.on('data', () => {});

        ffmpegProcess.on('close', (code) => {
            clearTimeout(killTimeout);
            if (code === 0) {
                console.log(`✅ [${new Date().toLocaleTimeString()}] Segment ${filename} completed successfully.`);
            } else if (code !== 0 && code !== null) {
                console.error(`🔴 FFmpeg process exited with code ${code}`);
            }
            resolve();
        });

        ffmpegProcess.on('error', (err) => {
            clearTimeout(killTimeout);
            console.error('🔴 Failed to start FFmpeg process:', err);
            reject(err);
        });
    });
}

async function cleanupOldSegments() {
    if (!bufferPath) {
        console.error('🔴 Critical Error: VIDEO_BUFFER_PATH is not available in cleanupOldSegments.');
        return;
    }
    try {
        const files = await readdir(bufferPath);
        const now = Date.now();
        const retentionMillis = bufferRetentionMinutes * 60 * 1000;

        for (const file of files) {
            if (!file.startsWith('segment_') || !file.endsWith('.mp4')) continue;

            const filePath = path.join(bufferPath, file);
            const stats = await stat(filePath);

            if (now - stats.mtime.getTime() > retentionMillis) {
                console.log(`🧹 Deleting old segment: ${file}`);
                await unlink(filePath);
            }
        }
    } catch (error) {
        console.error('🔴 Error during buffer cleanup:', error);
    }
}

async function main() {
    if (!rtspUrl || !bufferPath) {
        console.error('🔴 FATAL: RTSP_URL and VIDEO_BUFFER_PATH environment variables must be set before starting.');
        process.exit(1);
    }

    console.log('--- 📹 UniPlateTracker Video Buffer Manager ---');
    console.log(`Buffer Path: ${bufferPath}`);
    console.log(`Segment Duration: ${segmentDuration}s`);
    console.log(`Retention: ${bufferRetentionMinutes} minutes`);
    console.log('-------------------------------------------');
    await cleanupOldSegments();
    setInterval(cleanupOldSegments, cleanupInterval);
    while (true) {
        try {
            await createSegment();
        } catch (error) {
            console.error('🔴 An error occurred in the segment creation loop:', error);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

main();