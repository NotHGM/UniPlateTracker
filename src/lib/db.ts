// src/lib/db.ts
import { Pool } from 'pg';

declare global {
    var pool: Pool | undefined;
}

const pool = global.pool || new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_URL ? {
        rejectUnauthorized: false,
    } : false,
});

if (process.env.NODE_ENV !== 'production') {
    global.pool = pool;
}

export default pool;