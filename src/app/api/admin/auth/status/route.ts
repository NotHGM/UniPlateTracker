// src/app/api/admin/auth/status/route.ts
import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET() {
    // @ts-ignore
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    if (session.user) {
        return NextResponse.json({ isLoggedIn: true });
    } else {
        return NextResponse.json({ isLoggedIn: false });
    }
}