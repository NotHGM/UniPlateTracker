// src/app/api/admin/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcrypt';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const { email, password } = await req.json();
    if (!email || !password) {
        return NextResponse.json({ message: 'Email and password are required.' }, { status: 400 });
    }
    const lowerCaseEmail = email.toLowerCase();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const approvedRes = await client.query('SELECT id FROM approved_emails WHERE email = $1', [lowerCaseEmail]);
        if (approvedRes.rows.length === 0) {
            return NextResponse.json({ message: 'This email is not approved for signup.' }, { status: 403 });
        }
        const existingUserRes = await client.query('SELECT id FROM admin_users WHERE email = $1', [lowerCaseEmail]);
        if (existingUserRes.rows.length > 0) {
            return NextResponse.json({ message: 'An account with this email already exists.' }, { status: 409 });
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const newUserRes = await client.query('INSERT INTO admin_users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [lowerCaseEmail, passwordHash]);
        const newUser = newUserRes.rows[0];
        // @ts-ignore
        const session = await getIronSession<SessionData>(cookies(), sessionOptions);
        session.user = { id: newUser.id, email: newUser.email };
        await session.save();
        await client.query('COMMIT');

        return NextResponse.json({ success: true, message: 'Signup successful!' }, { status: 201 });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Signup error:', error);
        return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
    } finally {
        client.release();
    }
}