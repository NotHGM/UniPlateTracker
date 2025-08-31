// src/app/api/videos/[filename]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { stat, createReadStream } from 'fs';
import { promisify } from 'util';
import path from 'path';

const statAsync = promisify(stat);

// Helper function to stream a file with a given content type
function streamFile(fullPath: string, fileStat: any, contentType: string): NextResponse {
    const stream = createReadStream(fullPath);
    return new NextResponse(stream as any, {
        status: 200,
        headers: {
            'Content-Type': contentType,
            'Content-Length': fileStat.size.toString(),
            'Content-Disposition': `inline; filename="${path.basename(fullPath)}"`,
        },
    });
}

export async function GET(
    req: NextRequest,
    { params }: { params: { filename: string } }
) {
    const videoCapturePath = process.env.VIDEO_FINAL_CAPTURE_PATH;

    if (!videoCapturePath) {
        console.error('FATAL: VIDEO_FINAL_CAPTURE_PATH not set in Next.js process!');
        return new NextResponse(JSON.stringify({ error: 'Video capture path not configured.' }), { status: 500 });
    }

    const filename = params.filename;
    const sanitizedFilename = path.basename(filename);

    if (sanitizedFilename !== filename) {
        return new NextResponse(JSON.stringify({ error: 'Invalid filename' }), { status: 400 });
    }

    const isThumbnailRequest = sanitizedFilename.endsWith('.jpg');
    const contentType = isThumbnailRequest ? 'image/jpeg' : 'video/mp4';
    const fullPath = path.join(videoCapturePath, sanitizedFilename);

    try {
        const fileStat = await statAsync(fullPath);

        if (fileStat.isFile()) {
            return streamFile(fullPath, fileStat, contentType);
        } else {
            return new NextResponse(JSON.stringify({ error: 'Not a file.' }), { status: 404 });
        }
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return new NextResponse(JSON.stringify({ error: 'File not found.' }), { status: 404 });
        }
        console.error('Error in video API route:', error);
        return new NextResponse(JSON.stringify({ error: 'Internal server error.' }), { status: 500 });
    }
}