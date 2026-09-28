/**
 * Database connection.
 *
 * Neon over HTTP when the URL points at Neon, otherwise a standard Postgres driver (for
 * example in CI or tests). Either way this is plain PostgreSQL — the
 * application is not tied to a provider (ADR-0002).
 *
 * SERVER ONLY. Importing this from a client component would attempt to ship a database
 * credential to the browser (NFR-SEC-01, NFR-SEC-02).
 */
import 'server-only';

import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '@/config/env';

import * as schema from './schema';

const isNeon = /\.neon\.tech/i.test(env.DATABASE_URL);

function createDb() {
  if (isNeon) {
    return drizzleHttp(neon(env.DATABASE_URL), { schema });
  }

  // Local Postgres. A small pool is plenty for development, and `prepare: false`
  // keeps behaviour consistent with the HTTP driver.
  const client = postgres(env.DATABASE_URL, { max: 5, prepare: false });
  return drizzlePg(client, { schema });
}

/**
 * Reused across hot reloads in development, otherwise every refresh opens a new pool
 * and eventually exhausts connections.
 */
const globalForDb = globalThis as unknown as {
  __campDb?: ReturnType<typeof createDb>;
};

export const db = globalForDb.__campDb ?? createDb();

if (env.NODE_ENV !== 'production') {
  globalForDb.__campDb = db;
}

export { schema };
