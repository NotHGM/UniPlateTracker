// src/app/api/admin/auth/signup/route.ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcrypt";

export async function POST(req: NextRequest) {
    const { email, password } = await req.json();

    if (!email || !password || password.length < 8) {
        return NextResponse.json({ error: "Email and a password of at least 8 characters are required." }, { status: 400 });
    }

    const client = await pool.connect();
    try {
        const approvedResult = await client.query(`SELECT 1 FROM approved_emails WHERE email = $1`, [email]);
        if (approvedResult.rowCount === 0) {
            return NextResponse.json({ error: "This email address is not approved for admin access." }, { status: 403 });
        }

        const existingResult = await client.query(`SELECT 1 FROM admin_users WHERE email = $1`, [email]);
        if (existingResult.rowCount > 0) {
            return NextResponse.json({ error: "An admin account with this email already exists." }, { status: 409 });
        }

        const password_hash = await bcrypt.hash(password, 12);
        await client.query(
            `INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)`,
            [email, password_hash]
        );

        return NextResponse.json({ message: "Signup successful. Please log in." }, { status: 201 });
    } catch (err) {
        console.error("[SIGNUP_ERROR]", err);
        return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
    } finally {
        client.release();
    }
}