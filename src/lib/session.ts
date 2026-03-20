// src/lib/session.ts
import { SessionOptions } from 'iron-session';

const parseBoolean = (value: string | undefined): boolean | null => {
    if (value === undefined) {
        return null;
    }

    return value.toLowerCase() === 'true';
};

const secureOverride = parseBoolean(process.env.SESSION_COOKIE_SECURE);
const secureFromUrl = (process.env.NEXTAUTH_URL ?? '').toLowerCase().startsWith('https://');
const useSecureCookie = secureOverride ?? (process.env.NODE_ENV === 'production' ? secureFromUrl : false);

export const sessionOptions: SessionOptions = {
    cookieName: 'uniplate-session',
    password: process.env.SESSION_SECRET as string,
    cookieOptions: {
        secure: useSecureCookie,
        httpOnly: true,
        sameSite: 'lax',
    },
};

export interface SessionData {
    user?: {
        id: number;
        email: string;
    };
}