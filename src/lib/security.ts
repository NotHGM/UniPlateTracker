import { NextRequest } from 'next/server';

export function isSameOriginRequest(request: NextRequest): boolean {
    const originHeader = request.headers.get('origin');

    // Some non-browser clients omit Origin; allow those and only reject explicit cross-origin requests.
    if (!originHeader) {
        return true;
    }

    try {
        return new URL(originHeader).origin === request.nextUrl.origin;
    } catch {
        return false;
    }
}

export const AdminEmailSchema = {
    parse(email: unknown): string | null {
        if (typeof email !== 'string') {
            return null;
        }

        const normalized = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(normalized) ? normalized : null;
    },
};
