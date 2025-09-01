// src/app/api/admin/activity/route.ts
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET() {
    // @ts-ignore
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    const currentUser = session.user;
    if (!currentUser) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }
    try {
        const userCheckRes = await pool.query('SELECT added_by FROM approved_emails WHERE email = $1', [currentUser.email]);
        if (userCheckRes.rows.length === 0 || userCheckRes.rows[0].added_by !== null) {
            return new NextResponse(JSON.stringify({ error: 'Access Denied: Log is for initial admin only.' }), { status: 403 });
        }
        const query = `
            SELECT log.id, log.timestamp, log.action_type, log.target_email, actor.email AS actor_email
            FROM admin_activity_log log
                     LEFT JOIN admin_users actor ON log.actor_user_id = actor.id
            ORDER BY log.timestamp DESC LIMIT 50;
        `;
        const { rows } = await pool.query(query);
        return NextResponse.json(rows);
    } catch (error) {
        console.error("Failed to fetch activity log:", error);
        return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
}