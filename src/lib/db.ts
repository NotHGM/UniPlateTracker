// src/lib/db.ts
import { Pool } from 'pg';

declare global {
    var pool: Pool | undefined;
}

const isProduction = process.env.NODE_ENV === 'production';
const shouldUseSsl = isProduction || process.env.POSTGRES_SSL === 'true';
const rejectUnauthorized = process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false';

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