// src/lib/session.ts
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const sessionOptions = {
    cookieName: 'admin_session',
    password: process.env.SESSION_SECRET as string,
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
    },
};

export async function getSession() {
    const session = await getIronSession<{ user?: { email: string } }>(
        cookies(),
        sessionOptions
    );
    return session;
}
