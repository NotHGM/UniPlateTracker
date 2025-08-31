// src/lib/session.ts

import { IronSessionOptions } from 'iron-session';

export const sessionOptions: IronSessionOptions = {
    cookieName: 'uniplate-session',
    password: process.env.SESSION_SECRET as string,
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