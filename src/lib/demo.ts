// src/lib/demo.ts
import { NextResponse } from 'next/server';

/**
 * Demo mode: everything is visible, nothing can be changed.
 *
 * The public demo at uniplatetracker-demo.hgm.gg hands out admin credentials
 * to anyone who visits, because the admin dashboard is half of what there is
 * to look at and hiding it would show people a fraction of the application.
 * That only works if signing in as the demo admin cannot actually alter
 * anything, so every route that writes refuses while this flag is set.
 *
 * The flag is read from the environment at request time rather than baked in
 * at build time. That is deliberate: it means the demo and a real deployment
 * run the identical image, and a production instance can never accidentally
 * inherit a demo build.
 */
export function isDemoMode(): boolean {
    return process.env.DEMO_MODE === 'true';
}

/**
 * The credentials shown on the sign-in page while in demo mode.
 *
 * Published on purpose. A demo that asks for a password it never gives you is
 * just a login screen. Returns null outside demo mode so there is no path by
 * which a real deployment prints a password into its own HTML.
 */
export function getDemoCredentials(): { email: string; password: string } | null {
    if (!isDemoMode()) {
        return null;
    }

    return {
        email: process.env.DEMO_ADMIN_EMAIL || 'demo@hgm.gg',
        password: process.env.DEMO_ADMIN_PASSWORD || 'demo1234',
    };
}

/** Shown to the user, so it explains the refusal rather than just stating it. */
export const DEMO_WRITE_BLOCKED_MESSAGE =
    'This is a read-only demo, so changes are disabled. Everything else works exactly as it does in a real deployment.';

/**
 * The refusal itself.
 *
 * 403 rather than 405 or 501: the request is well-formed and the route exists,
 * the caller simply is not allowed to do it here. Both the `error` and
 * `message` keys are set because the admin routes and the auth routes read
 * different fields when they surface a failure, and a demo visitor should get
 * the explanation either way instead of a bare "Failed to add admin".
 */
export function demoWriteBlockedResponse(): NextResponse {
    return NextResponse.json(
        { error: DEMO_WRITE_BLOCKED_MESSAGE, message: DEMO_WRITE_BLOCKED_MESSAGE, demo: true },
        { status: 403 },
    );
}
