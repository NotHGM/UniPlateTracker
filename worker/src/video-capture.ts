// worker/src/video-capture.ts
import { spawn } from 'child_process';
import { promises as fs, existsSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Configuration Constants
const SEGMENT_DURATION_SECONDS = 2;
// Keep a large buffer of segments, e.g., 5 minutes worth (300 seconds / 2s segments = 150 segments)
const SEGMENTS_TO_KEEP = 150;
const STREAM_LATENCY_SECONDS = 60; // The 60-second delay you observed. This is now a configurable value.

class VideoCapture {
    private ffmpegProcess: ReturnType<typeof spawn> | null = null;
    private isInitialized = false;

    private rtspUrl: string | undefined;
    private videoCapturePath: string | undefined;
    private preBufferSeconds: number = 5;
    private postBufferSeconds: number = 5;
    private tempSegmentPath: string = '';

    public async start() {
        const {
            RTSP_URL,
            VIDEO_CAPTURE_PATH,
            VIDEO_PREBUFFER_SECONDS = '5',
            VIDEO_POSTBUFFER_SECONDS = '5',
        } = process.env;

        this.rtspUrl = RTSP_URL;
        this.videoCapturePath = VIDEO_CAPTURE_PATH;
        this.preBufferSeconds = parseInt(VIDEO_PREBUFFER_SECONDS, 10);
        this.postBufferSeconds = parseInt(VIDEO_POSTBUFFER_SECONDS, 10);
        this.tempSegmentPath = path.join(__dirname, '..', 'temp_segments');

        if (!this.rtspUrl || !this.videoCapturePath) {
            console.error("Video Capture disabled: RTSP_URL or VIDEO_CAPTURE_PATH is not set in .env.local.");
            return;
        }

        if (this.isInitialized) return;

        this.isInitialized = true;
        console.log('📹 Starting continuous video stream buffering...');

        await fs.mkdir(this.tempSegmentPath, { recursive: true });
        await fs.mkdir(this.videoCapturePath, { recursive: true });

        await this.cleanupTempFiles();

        // Revert to the simpler, copy-based command that we know produces video
        const args = [
            '-rtsp_transport', 'tcp',
            '-i', this.rtspUrl,
            '-an', // Still important to disable audio
            '-c:v', 'copy',
            '-f', 'segment',
            '-segment_time', String(SEGMENT_DURATION_SECONDS),
            '-segment_wrap', String(SEGMENTS_TO_KEEP),
            '-segment_format', 'mpegts',
            '-reset_timestamps', '1',
            path.join(this.tempSegmentPath, 'capture-%d.ts')
        ];

        this.ffmpegProcess = spawn('ffmpeg', args, { stdio: 'pipe' });

        this.ffmpegProcess.stderr?.on('data', (data) => {
            // For debugging: console.error(`[ffmpeg buffer]: ${data.toString()}`);
        });

        this.ffmpegProcess.on('exit', (code) => {
            console.error(`FFmpeg buffering process exited with code ${code}. Restarting...`);
            this.isInitialized = false;
            this.ffmpegProcess = null;
            setTimeout(() => this.start(), 5000);
        });

        console.log('✅ Video stream buffering is active.');
    }

    public async captureClip(plateNumber: string): Promise<string | null> {
        if (!this.isInitialized || !this.videoCapturePath) {
            console.warn("Video capture is not running. Cannot create clip.");
            return null;
        }

        try {
            // No need to wait here. We'll use math instead.
            console.log(`[${plateNumber}] Event received. Calculating correct segments...`);

            // 1. Calculate the total clip duration and number of segments needed
            const totalDuration = this.preBufferSeconds + this.postBufferSeconds;
            const segmentsNeededForClip = Math.ceil(totalDuration / SEGMENT_DURATION_SECONDS);

            // 2. Calculate the number of segments to *skip* from the end due to latency
            const segmentsToSkip = Math.floor(STREAM_LATENCY_SECONDS / SEGMENT_DURATION_SECONDS);

            // 3. Get all available segments, sorted numerically
            const allSegments = (await fs.readdir(this.tempSegmentPath))
                .filter(f => f.endsWith('.ts'))
                .sort((a, b) => parseInt(a.match(/\d+/)?.[0] || '0') - parseInt(b.match(/\d+/)?.[0] || '0'));

            if (allSegments.length < segmentsNeededForClip + segmentsToSkip) {
                console.warn(`Not enough buffered segments to create a non-latent clip yet.`);
                return null;
            }

            // 4. THIS IS THE FIX: Instead of taking from the very end, we take from an earlier point.
            // We go to the end of the array, step back `segmentsToSkip` places to get to the "real-time" segment,
            // then step back another `segmentsNeededForClip` places to get the start of our desired clip.
            const endIndex = allSegments.length - segmentsToSkip;
            const startIndex = endIndex - segmentsNeededForClip;

            if (startIndex < 0) {
                console.warn("Buffer is not large enough to construct the full pre-roll period.");
                return null;
            }

            const segmentsForClip = allSegments.slice(startIndex, endIndex);

            console.log(`Using segments from index ${startIndex} to ${endIndex} to correct for ~${STREAM_LATENCY_SECONDS}s latency.`);

            // --- The rest of the function is the same ---
            const fileListPath = path.join(this.tempSegmentPath, 'mylist.txt');
            const fileListData = segmentsForClip.map(f => `file '${path.join(this.tempSegmentPath, f)}'`).join('\n');
            await fs.writeFile(fileListPath, fileListData);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const finalFilename = `${plateNumber}_${timestamp}.mp4`;
            const finalOutputPath = path.join(this.videoCapturePath, finalFilename);

            console.log(`🎬 Stitching ${segmentsForClip.length} segments into ${finalFilename}...`);

            await new Promise<void>((resolve, reject) => {
                const stitchProcess = spawn('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', fileListPath, '-c', 'copy', '-y', finalOutputPath]);
                stitchProcess.on('exit', (code) => {
                    if (code === 0) {
                        console.log(`✅ Successfully created clip: ${finalOutputPath}`);
                        resolve();
                    } else {
                        reject(new Error(`FFmpeg stitch exited with code ${code}`));
                    }
                });
            });

            await fs.unlink(fileListPath);
            return finalFilename;
        } catch (error) {
            console.error("❌ Error capturing video clip:", error);
            return null;
        }
    }

    private async cleanupTempFiles() {
        if (!existsSync(this.tempSegmentPath)) return;
        const files = await fs.readdir(this.tempSegmentPath);
        for (const file of files) {
            if (file.endsWith('.ts') || file.endsWith('.txt')) {
                await fs.unlink(path.join(this.tempSegmentPath, file));
            }
        }
        console.log("🧹 Cleaned up temporary segment files.");
    }
}

export const videoCapture = new VideoCapture();