import { Pool } from 'pg';

// Declare a global variable to hold the connection pool.
// The 'declare' keyword is used to tell TypeScript that this variable exists,
// even if we don't assign it a value here.
declare global {
    // eslint-disable-next-line no-var
    var pool: Pool | undefined;
}

// Instantiate the connection pool.
// We check if a pool already exists in the global scope. If it does, we reuse it.
// If not, we create a new one. This is crucial for development environments where
// Next.js hot-reloading can cause multiple pool instances to be created.
const pool = global.pool || new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
        // In production, you'll likely need to connect to your database over SSL.
        // Set this to `false` if your database doesn't require SSL.
        rejectUnauthorized: false,
    },
});

// If we're not in a production environment, we store the pool instance
// in the global scope so it can be reused across hot reloads.
if (process.env.NODE_ENV !== 'production') {
    global.pool = pool;
}

export default pool;