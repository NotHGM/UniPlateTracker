// src/app/api/admin/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcrypt';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
    const { email, password } = await req.json();
    if (!email || !password) {
        return new NextResponse(JSON.stringify({ message: 'Email and password required.' }), { status: 400 });
    }

    try {
        const result = await pool.query('SELECT id, email, password_hash FROM admin_users WHERE email = $1', [email.toLowerCase()]);
        if (result.rows.length === 0) {
            return new NextResponse(JSON.stringify({ message: 'Invalid credentials.' }), { status: 401 });
        }
        const user = result.rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return new NextResponse(JSON.stringify({ message: 'Invalid credentials.' }), { status: 401 });
        }

        // @ts-ignore
        const session = await getIronSession<SessionData>(cookies(), sessionOptions);
        session.user = { id: user.id, email: user.email };
        await session.save();

        return new NextResponse(JSON.stringify({ success: true, message: 'Login successful' }), { status: 200 });
    } catch (error) {
        console.error('Login error:', error);
        return new NextResponse(JSON.stringify({ message: 'Internal server error.' }), { status: 500 });
    }
}