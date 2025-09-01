// src/app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
import { getAdminStats } from '@/lib/data';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
    // @ts-ignore
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);

    if (!session.user) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    try {
        const stats = await getAdminStats();
        return NextResponse.json(stats);
    } catch (error) {
        console.error('API Admin Stats Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}