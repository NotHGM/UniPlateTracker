// src/app/api/videos/[filename]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

export const dynamic = 'force-dynamic';

async function generateThumbnail(videoPath: string): Promise<Buffer> {
    const tempThumbPath = path.join(os.tmpdir(), `thumb-${Date.now()}.jpg`);

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-ss', '00:00:00.500',
            '-vframes', '1',
            '-vf', 'scale=320:-1',
            '-q:v', '4',
            '-f', 'image2',
            tempThumbPath
        ]);

        let errorOutput = '';
        ffmpeg.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        ffmpeg.on('close', async (code) => {
            if (code === 0) {
                try {
                    const thumbBuffer = await fs.readFile(tempThumbPath);
                    await fs.unlink(tempThumbPath);
                    resolve(thumbBuffer);
                } catch (readError) {
                    reject(readError);
                }
            } else {
                reject(new Error(`FFmpeg exited with code ${code}. Stderr: ${errorOutput}`));
            }
        });

        ffmpeg.on('error', (err) => reject(err));
    });
}

export async function GET(
    request: NextRequest,
    { params }: { params: { filename: string } }
) {
    const { searchParams } = new URL(request.url);
    const wantsThumbnail = searchParams.get('thumbnail') === 'true';

    const videoPath = process.env.VIDEO_CAPTURE_PATH;

    if (!videoPath) {
        return new NextResponse("Server configuration error", { status: 500 });
    }

    try {
        const filename = params.filename;
        const sanitizedFilename = path.basename(filename);
        if (sanitizedFilename !== filename) {
            return new NextResponse("Invalid filename", { status: 400 });
        }

        const fullPath = path.join(videoPath, sanitizedFilename);
        await fs.access(fullPath);

        if (wantsThumbnail) {
            const thumbBuffer = await generateThumbnail(fullPath);
            return new NextResponse(thumbBuffer, {
                status: 200,
                headers: { 'Content-Type': 'image/jpeg' },
            });
        } else {
            const videoBuffer = await fs.readFile(fullPath);
            return new NextResponse(videoBuffer, {
                status: 200,
                headers: { 'Content-Type': 'video/mp4', 'Content-Length': videoBuffer.length.toString() },
            });
        }

    } catch (error) {
        console.error(`Error serving media for ${params.filename}:`, error);
        return new NextResponse("Media not found or unreadable", { status: 404 });
    }
}