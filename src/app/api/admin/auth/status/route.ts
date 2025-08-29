// src/app/api/admin/auth/status/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
    const session = await getSession();

    if (session.user) {
        return NextResponse.json({ isLoggedIn: true });
    } else {
        return NextResponse.json({ isLoggedIn: false });
    }
}