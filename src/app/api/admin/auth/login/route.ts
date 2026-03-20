// src/app/api/admin/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcrypt';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { isSameOriginRequest, AdminEmailSchema } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    if (!isSameOriginRequest(req)) {
        return NextResponse.json({ message: 'Invalid request origin.' }, { status: 403 });
    }

    let body: { email?: unknown; password?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
    }

    const email = AdminEmailSchema.parse(body.email);
    const password = typeof body.password === 'string' ? body.password : null;

    if (!email || !password) {
        // Using NextResponse.json() for cleaner code and correct headers.
        return NextResponse.json({ message: 'Email and password required.' }, { status: 400 });
    }
    try {
        const result = await pool.query('SELECT id, email, password_hash FROM admin_users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
        }
        const user = result.rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
        }
        // @ts-ignore
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        session.user = { id: user.id, email: user.email };
        await session.save();

        return NextResponse.json({ success: true, message: 'Login successful' }, { status: 200 });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
    }
}