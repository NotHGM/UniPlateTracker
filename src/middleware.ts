// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';

const sessionOptions = {
    cookieName: 'admin_session',
    password: process.env.SESSION_SECRET as string,
};

export async function middleware(request: NextRequest) {
    const session = await getIronSession<{ user?: { email: string } }>(
        request.cookies,
        sessionOptions
    );

    const { pathname } = request.nextUrl;
    const isLoggedIn = !!session.user;

    if (pathname.startsWith('/admin/auth')) {
        if (isLoggedIn) {
            return NextResponse.redirect(new URL('/admin', request.url));
        }
        return NextResponse.next();
    }

    if (!isLoggedIn) {
        return NextResponse.redirect(new URL('/admin/auth', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*'],
};