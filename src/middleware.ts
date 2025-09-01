// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { sessionOptions } from '@/lib/session';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if the session cookie exists, without trying to decrypt it.
    const cookie = request.cookies.get(sessionOptions.cookieName);
    const isLoggedIn = cookie !== undefined;

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