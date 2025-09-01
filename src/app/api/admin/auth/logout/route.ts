// src/app/api/admin/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST() {
    // @ts-ignore
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    session.destroy();
    return NextResponse.json({ message: "Logout successful" });
}