import { NextRequest } from 'next/server';

function normalizeHost(value: string): string {
    const trimmed = value.trim().toLowerCase();

    // Remove default ports so localhost and localhost:80 compare equal.
    if (trimmed.endsWith(':80')) {
        return trimmed.slice(0, -3);
    }

    if (trimmed.endsWith(':443')) {
        return trimmed.slice(0, -4);
    }

    return trimmed;
}

function parseAllowedOriginHosts(): Set<string> {
    const hosts = new Set<string>();
    const raw = process.env.NEXT_ALLOWED_DEV_ORIGINS;
    const canonicalAppUrl = process.env.NEXTAUTH_URL;

    if (!raw) {
        // Continue to parse canonical URL below even without explicit allowlist.
    } else {
        for (const entry of raw.split(',')) {
            const cleaned = entry.trim();
            if (!cleaned) {
                continue;
            }

            try {
                const parsed = new URL(cleaned.includes('://') ? cleaned : `http://${cleaned}`);
                hosts.add(normalizeHost(parsed.host));
            } catch {
                // Ignore malformed entries in allowlist.
            }
        }
    }

    if (canonicalAppUrl) {
        try {
            const parsed = new URL(canonicalAppUrl);
            hosts.add(normalizeHost(parsed.host));
        } catch {
            // Ignore malformed canonical URL.
        }
    }

    return hosts;
}

export function isSameOriginRequest(request: NextRequest): boolean {
    const originHeader = request.headers.get('origin');

    // Some non-browser clients omit Origin; allow those and only reject explicit cross-origin requests.
    if (!originHeader) {
        return true;
    }

    try {
        const originUrl = new URL(originHeader);
        const originHost = normalizeHost(originUrl.host);

        const candidateHosts = new Set<string>();
        candidateHosts.add(normalizeHost(request.nextUrl.host));

        const hostHeader = request.headers.get('host');
        if (hostHeader) {
            candidateHosts.add(normalizeHost(hostHeader));
        }

        const forwardedHost = request.headers.get('x-forwarded-host');
        if (forwardedHost) {
            const firstForwardedHost = forwardedHost.split(',')[0]?.trim();
            if (firstForwardedHost) {
                candidateHosts.add(normalizeHost(firstForwardedHost));
            }
        }

        if (candidateHosts.has(originHost)) {
            return true;
        }

        const allowedHosts = parseAllowedOriginHosts();
        if (allowedHosts.has(originHost)) {
            return true;
        }

        // In proxy deployments, Fetch metadata can still confirm browser same-site intent.
        const fetchSite = request.headers.get('sec-fetch-site');
        if (fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none') {
            return true;
        }

        return false;
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
