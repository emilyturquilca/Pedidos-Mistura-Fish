import pg from 'pg';
let pool;
export function db() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 7000 });
  }
  return pool;
}
// Dependency injection is used by integration tests, never configured from requests.
export function useTestPool(value) { if (process.env.NODE_ENV !== 'test') throw new Error('Tests only'); pool = value; }

