// src/app/api/admin/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function POST() {
    const session = await getSession();
    session.destroy();
    return NextResponse.json({ message: "Logout successful" });
}