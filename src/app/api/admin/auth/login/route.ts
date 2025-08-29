// src/app/api/admin/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcrypt";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
    const { email, password } = await req.json();
    if (!email || !password) {
        return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM admin_users WHERE email = $1', [email]);

        if (result.rowCount === 0) {
            return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
        }

        const session = await getSession();
        session.user = { email: user.email };
        await session.save();

        return NextResponse.json({ message: "Login successful" }, { status: 200 });
    } catch (err) {
        console.error("LOGIN ERROR", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    } finally {
        client.release();
    }
}