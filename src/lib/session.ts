// src/lib/session.ts

import { IronSession, getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

export const sessionOptions = {
    password: process.env.SESSION_SECRET as string,
    cookieName: 'uniplate-session',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
    },
};

export interface SessionData {
    user?: {
        id: number;
        email: string;
    };
}

export async function getSession(): Promise<IronSession<SessionData>> {
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    return session;
}