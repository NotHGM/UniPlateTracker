// src/lib/session.ts
import { SessionOptions } from 'iron-session';

export const sessionOptions: SessionOptions = {
    cookieName: 'uniplate-session',
    password: process.env.SESSION_SECRET as string,
    cookieOptions: {
        secure: false,
        httpOnly: true,
    },
};

export interface SessionData {
    user?: {
        id: number;
        email: string;
    };
}