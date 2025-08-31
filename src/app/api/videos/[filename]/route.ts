// src/app/api/videos/[filename]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { stat, createReadStream } from 'fs';
import { promisify } from 'util';
import path from 'path';

const statAsync = promisify(stat);

function streamFile(fullPath: string, fileStat: any): NextResponse {
    const stream = createReadStream(fullPath);
    return new NextResponse(stream as any, {
        status: 200,
        headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': fileStat.size.toString(),
            'Content-Disposition': `inline; filename="${path.basename(fullPath)}"`,
            'Accept-Ranges': 'bytes',
        },
    });
}

export async function GET(
    req: NextRequest,
    { params }: { params: { filename: string } }
) {
    const videoCapturePath = process.env.VIDEO_FINAL_CAPTURE_PATH;

    if (!videoCapturePath) {
        console.error('FATAL: VIDEO_FINAL_CAPTURE_PATH environment variable is not set in the Next.js process!');
        return new NextResponse(JSON.stringify({ error: 'Video capture path is not configured on the server.' }), { status: 500 });
    }

    const filename = params.filename;
    const sanitizedFilename = path.basename(filename);
    if (sanitizedFilename !== filename) {
        return new NextResponse(JSON.stringify({ error: 'Invalid filename' }), { status: 400 });
    }

    const fullPath = path.join(videoCapturePath, sanitizedFilename);

    try {
        const fileStat = await statAsync(fullPath);

        if (fileStat.isFile()) {
            return streamFile(fullPath, fileStat);
        } else {
            return new NextResponse(JSON.stringify({ error: 'Requested resource is not a file.' }), { status: 404 });
        }
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return new NextResponse(JSON.stringify({ error: 'Video file not found.' }), { status: 404 });
        } else if (error.code === 'EACCES') {
            console.error(`Permission denied error when trying to access: ${fullPath}`);
            return new NextResponse(JSON.stringify({ error: 'Permission denied to access video file.' }), { status: 500 });
        }
        console.error('An unhandled error occurred in the video API route:', error);
        return new NextResponse(JSON.stringify({ error: 'An internal server error occurred.' }), { status: 500 });
    }
}