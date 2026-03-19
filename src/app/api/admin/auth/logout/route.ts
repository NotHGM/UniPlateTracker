// src/app/api/admin/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { isSameOriginRequest } from '@/lib/security';

export async function POST(req: NextRequest) {
    if (!isSameOriginRequest(req)) {
        return NextResponse.json({ message: 'Invalid request origin.' }, { status: 403 });
    }

    // @ts-ignore
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    session.destroy();
    return NextResponse.json({ message: "Logout successful" });
}