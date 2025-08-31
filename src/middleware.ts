// src/middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';

export async function middleware(request: NextRequest) {
    const session = await getIronSession<SessionData>(
        request.cookies,
        sessionOptions
    );

    const { pathname } = request.nextUrl;
    const isLoggedIn = !!session.user;

    if (!isLoggedIn && pathname.startsWith('/admin') && pathname !== '/admin/auth') {
        return NextResponse.redirect(new URL('/admin/auth', request.url));
    }

    if (isLoggedIn && pathname === '/admin/auth') {
        return NextResponse.redirect(new URL('/admin', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*', '/admin'],
};