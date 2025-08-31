// src/app/api/admin/management/route.ts

import pool from '@/lib/db';
import { getSession } from '@/lib/session';
import { NextRequest, NextResponse } from 'next/server';

interface SessionUser {
    id: number;
    email: string;
}

// GET: Fetch all current admins
export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session.user) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    try {
        const query = `
            SELECT ae.id, ae.email, ae.created_at, u_adder.email as added_by_email
            FROM approved_emails ae
                     LEFT JOIN admin_users u_adder ON ae.added_by = u_adder.id -- FIXED
            ORDER BY ae.created_at DESC;
        `;
        const { rows } = await pool.query(query);
        return NextResponse.json(rows);
    } catch (error) {
        console.error("Failed to fetch admins:", error);
        return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
}

// POST: Add a new admin email
export async function POST(req: NextRequest) {
    const session = await getSession();
    const currentUser = session.user as SessionUser | undefined;

    if (!currentUser) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
        return new NextResponse(JSON.stringify({ error: 'Invalid email' }), { status: 400 });
    }
    const sanitizedEmail = email.toLowerCase().trim();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existing = await client.query('SELECT id FROM approved_emails WHERE email = $1', [sanitizedEmail]);
        if (existing.rows.length > 0) {
            return new NextResponse(JSON.stringify({ error: 'Email already approved' }), { status: 409 });
        }

        await client.query(
            'INSERT INTO approved_emails (email, added_by) VALUES ($1, $2)',
            [sanitizedEmail, currentUser.id]
        );

        await client.query(
            `INSERT INTO admin_activity_log (actor_user_id, action_type, target_email) VALUES ($1, 'ADD_ADMIN', $2)`,
            [currentUser.id, sanitizedEmail]
        );

        await client.query('COMMIT');
        return NextResponse.json({ success: true, message: `Email ${sanitizedEmail} approved.` });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Failed to add admin:", error);
        return new NextResponse(JSON.stringify({ error: 'Database error' }), { status: 500 });
    } finally {
        client.release();
    }
}


// DELETE: Revoke an admin's access
export async function DELETE(req: NextRequest) {
    const session = await getSession();
    const currentUser = session.user as SessionUser | undefined;

    if (!currentUser) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const { emailToRevoke } = await req.json();
    if (!emailToRevoke || typeof emailToRevoke !== 'string') {
        return new NextResponse(JSON.stringify({ error: 'Invalid email' }), { status: 400 });
    }

    if (currentUser.email === emailToRevoke) {
        return new NextResponse(JSON.stringify({ error: "You cannot revoke your own access." }), { status: 403 });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const targetAdminRes = await client.query('SELECT added_by FROM approved_emails WHERE email = $1', [emailToRevoke]);
        if (targetAdminRes.rows.length === 0) {
            return new NextResponse(JSON.stringify({ error: "Admin not found." }), { status: 404 });
        }

        const addedById = targetAdminRes.rows[0].added_by;
        if (addedById === currentUser.id) {
            return new NextResponse(JSON.stringify({ error: "You cannot revoke an admin you invited." }), { status: 403 });
        }

        await client.query('DELETE FROM admin_users WHERE email = $1', [emailToRevoke]); // FIXED
        await client.query('DELETE FROM approved_emails WHERE email = $1', [emailToRevoke]);

        await client.query(
            `INSERT INTO admin_activity_log (actor_user_id, action_type, target_email) VALUES ($1, 'REVOKE_ADMIN', $2)`,
            [currentUser.id, emailToRevoke]
        );

        await client.query('COMMIT');
        return NextResponse.json({ success: true, message: `Access for ${emailToRevoke} revoked.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Failed to revoke admin:", error);
        return new NextResponse(JSON.stringify({ error: 'Database error' }), { status: 500 });
    } finally {
        client.release();
    }
}