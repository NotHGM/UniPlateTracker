// worker/src/video-capture.ts
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Get configuration from environment variables
const {
    RTSP_URL,
    VIDEO_CAPTURE_PATH,
    VIDEO_CAPTURE_DURATION = '15',
} = process.env;

class VideoCapture {
    private isCapturing = false;

    /**
     * Connects to the RTSP stream and records a single clip for a fixed duration.
     * @param plateNumber The license plate number, used for the filename.
     * @returns The filename of the captured clip, or null if an error occurred.
     */
    public async captureClip(plateNumber: string): Promise<string | null> {
        if (!RTSP_URL || !VIDEO_CAPTURE_PATH) {
            console.error("Video Capture disabled: RTSP_URL or VIDEO_CAPTURE_PATH is not set in .env.local.");
            return null;
        }

        if (this.isCapturing) {
            console.warn(`[${plateNumber}] A capture is already in progress. Skipping this request.`);
            return null;
        }

        this.isCapturing = true;
        console.log(`[${plateNumber}] Starting on-demand video capture for ${VIDEO_CAPTURE_DURATION} seconds...`);

        try {
            await fs.mkdir(VIDEO_CAPTURE_PATH, { recursive: true });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const finalFilename = `${plateNumber}_${timestamp}.mp4`;
            const finalOutputPath = path.join(VIDEO_CAPTURE_PATH, finalFilename);

            // This FFmpeg command connects, records, and then exits.
            const args = [
                '-rtsp_transport', 'tcp',
                '-i', RTSP_URL,
                '-t', VIDEO_CAPTURE_DURATION, // Record for this many seconds
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-pix_fmt', 'yuv420p',
                '-an',
                '-y',
                finalOutputPath
            ];

            await new Promise<void>((resolve, reject) => {
                const ffmpegProcess = spawn('ffmpeg', args);

                ffmpegProcess.stderr?.on('data', (data) => {
                    // For debugging ffmpeg issues: console.log(`[ffmpeg]: ${data.toString()}`);
                });

                ffmpegProcess.on('exit', (code) => {
                    if (code === 0) {
                        console.log(`✅ Successfully captured clip: ${finalFilename}`);
                        resolve();
                    } else {
                        console.error(`FFmpeg capture process exited with code ${code}.`);
                        reject(new Error(`FFmpeg exited with code ${code}`));
                    }
                });

                ffmpegProcess.on('error', (err) => {
                    console.error('Failed to start FFmpeg process:', err);
                    reject(err);
                });
            });

            return finalFilename; // Return just the filename

        } catch (error) {
            console.error("❌ Error during on-demand video capture:", error);
            return null;
        } finally {
            this.isCapturing = false;
        }
    }
}

export const videoCapture = new VideoCapture();