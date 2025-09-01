// src/app/api/admin/management/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET() {
    // @ts-ignore
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    if (!session.user) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }
    try {
        const adminsQuery = `
            SELECT ae.id, ae.email, ae.created_at, u_adder.email as added_by_email
            FROM approved_emails ae
                     LEFT JOIN admin_users u_adder ON ae.added_by = u_adder.id
            ORDER BY ae.created_at DESC;
        `;
        const initialAdminQuery = `SELECT email FROM admin_users ORDER BY id ASC LIMIT 1;`;
        const [adminsRes, initialAdminRes] = await Promise.all([
            pool.query(adminsQuery), pool.query(initialAdminQuery)
        ]);
        const initialAdminEmail = initialAdminRes.rows.length > 0 ? initialAdminRes.rows[0].email : null;
        return NextResponse.json({ admins: adminsRes.rows, initialAdminEmail: initialAdminEmail });
    } catch (error) {
        console.error("Failed to fetch admins:", error);
        return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    // @ts-ignore
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    const currentUser = session.user;
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
        await client.query('INSERT INTO approved_emails (email, added_by) VALUES ($1, $2)', [sanitizedEmail, currentUser.id]);
        await client.query(`INSERT INTO admin_activity_log (actor_user_id, action_type, target_email) VALUES ($1, 'ADD_ADMIN', $2)`,[currentUser.id, sanitizedEmail]);
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

export async function DELETE(req: NextRequest) {
    // @ts-ignore
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    const currentUser = session.user;
    if (!currentUser) return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    const { emailToRevoke } = await req.json();
    if (!emailToRevoke) return new NextResponse(JSON.stringify({ error: 'Invalid email' }), { status: 400 });
    if (currentUser.email === emailToRevoke) return new NextResponse(JSON.stringify({ error: "Cannot revoke yourself." }), { status: 403 });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const initialAdminRes = await client.query(`SELECT email, id FROM admin_users ORDER BY id ASC LIMIT 1;`);
        if (initialAdminRes.rows.length === 0) { throw new Error("System error: No initial admin found."); }
        const initialAdmin = initialAdminRes.rows[0];
        if (emailToRevoke === initialAdmin.email) {
            return new NextResponse(JSON.stringify({ error: "The initial admin cannot be revoked." }), { status: 403 });
        }
        const targetAdminRes = await client.query('SELECT id, added_by FROM approved_emails WHERE email = $1', [emailToRevoke]);
        if (targetAdminRes.rows.length === 0) return new NextResponse(JSON.stringify({ error: "Admin not found." }), { status: 404 });
        const targetAdminId = targetAdminRes.rows[0].id;
        const currentUserRes = await client.query('SELECT added_by FROM approved_emails WHERE email = $1', [currentUser.email]);
        const myInviterId = currentUserRes.rows.length > 0 ? currentUserRes.rows[0].added_by : null;
        if (myInviterId === targetAdminId) {
            return new NextResponse(JSON.stringify({ error: "Cannot revoke the admin who invited you." }), { status: 403 });
        }
        await client.query('DELETE FROM admin_users WHERE email = $1', [emailToRevoke]);
        await client.query('DELETE FROM approved_emails WHERE email = $1', [emailToRevoke]);
        await client.query(`INSERT INTO admin_activity_log (actor_user_id, action_type, target_email) VALUES ($1, 'REVOKE_ADMIN', $2)`,[currentUser.id, emailToRevoke]);
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