// src/app/api/videos/[filename]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, Stats } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import path from 'path';

function streamFile(fullPath: string, fileStat: Stats, contentType: string): NextResponse {
    const nodeStream = createReadStream(fullPath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
        status: 200,
        headers: {
            'Content-Type': contentType,
            'Content-Length': fileStat.size.toString(),
            'Content-Disposition': `inline; filename="${path.basename(fullPath)}"`,
        },
    });
}

export async function GET(request: NextRequest) {
    const filename = request.nextUrl.pathname.split('/').pop();

    if (!filename) {
        return new NextResponse(JSON.stringify({ error: 'Filename is missing in the URL.' }), { status: 400 });
    }

    const videoCapturePath = process.env.VIDEO_FINAL_CAPTURE_PATH;

    if (!videoCapturePath) {
        console.error('FATAL: VIDEO_FINAL_CAPTURE_PATH not set in Next.js process!');
        return new NextResponse(JSON.stringify({ error: 'Video capture path not configured.' }), { status: 500 });
    }

    const sanitizedFilename = path.basename(filename);

    if (sanitizedFilename !== filename) {
        return new NextResponse(JSON.stringify({ error: 'Invalid filename' }), { status: 400 });
    }

    const isThumbnailRequest = sanitizedFilename.endsWith('.jpg');
    const contentType = isThumbnailRequest ? 'image/jpeg' : 'video/mp4';
    const fullPath = path.join(videoCapturePath, sanitizedFilename);

    try {
        const fileStat = await stat(fullPath);
        if (fileStat.isFile()) {
            return streamFile(fullPath, fileStat, contentType);
        } else {
            return new NextResponse(JSON.stringify({ error: 'Not a file.' }), { status: 404 });
        }
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return new NextResponse(JSON.stringify({ error: 'File not found.' }), { status: 404 });
            }
        }
        console.error('Error in video API route:', error);
        return new NextResponse(JSON.stringify({ error: 'Internal server error.' }), { status: 500 });
    }
}