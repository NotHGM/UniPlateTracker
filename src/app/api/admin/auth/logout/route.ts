// src/app/api/admin/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    void req;

    const cookieStore = await cookies();
    // @ts-ignore
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    session.destroy();

    // Ensure stale cookies are removed even if session destroy cannot decrypt previous values.
    cookieStore.delete(sessionOptions.cookieName);

    return NextResponse.json({ message: "Logout successful" });
}