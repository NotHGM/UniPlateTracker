// src/lib/db.ts
import { Pool } from 'pg';

declare global {
    var pool: Pool | undefined;
}

const parseBooleanEnv = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value === undefined) {
        return defaultValue;
    }

    return value.toLowerCase() === 'true';
};

// Respect explicit deployment config instead of forcing SSL in production.
const shouldUseSsl = parseBooleanEnv(process.env.POSTGRES_SSL, false);
const rejectUnauthorized = parseBooleanEnv(process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED, true);

const pool = global.pool || new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: shouldUseSsl
        ? {
            rejectUnauthorized,
        }
        : false,
});

if (process.env.NODE_ENV !== 'production') {
    global.pool = pool;
}

export default pool;