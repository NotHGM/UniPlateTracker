// next.config.ts
import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === 'production';
const allowedDevOrigins = Array.from(new Set([
    'localhost',
    '127.0.0.1',
    ...(process.env.NEXT_ALLOWED_DEV_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
        .flatMap((origin) => {
            if (origin.startsWith('http://') || origin.startsWith('https://')) {
                try {
                    const parsed = new URL(origin);
                    return [origin, parsed.hostname];
                } catch {
                    return [origin];
                }
            }
            return [origin, `http://${origin}`, `https://${origin}`];
        }),
]));

const ContentSecurityPolicy = `
  default-src 'self';
    script-src 'self' ${isProduction ? "'unsafe-inline'" : "'unsafe-inline' 'unsafe-eval'"};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self';
    frame-ancestors 'none';
`;

const nextConfig: NextConfig = {
    allowedDevOrigins,
        images: {
                // Disables Next.js image optimizer disk cache path to reduce cache growth risk.
                unoptimized: true,
        },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim(),
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()'
                    },
                    ...(isProduction
                        ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }]
                        : []),
                ],
            },
        ];
    },
};

export default nextConfig;