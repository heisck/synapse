import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma 7 no longer reads the connection URL from the schema — the client must
 * be constructed with a driver adapter. The libSQL adapter speaks both plain
 * SQLite files (`file:...`, used in local dev / self-hosting) and hosted libSQL
 * over the network (`libsql://...`, used on Vercel where the filesystem is
 * read-only and ephemeral), so the same code path works everywhere.
 *
 * TURSO_DATABASE_URL wins when present (production / hosted); otherwise we fall
 * back to DATABASE_URL, then a local dev file.
 */
// Treat blank / whitespace-only env values as unset. `.env.development.local`
// deliberately sets TURSO_DATABASE_URL="" to force local dev onto a file DB, and
// `??` alone would pass that empty string straight through to the adapter.
const firstSet = (...values: (string | undefined)[]) =>
  values.find((v) => v && v.trim().length > 0)

export function createPrismaClient(): PrismaClient {
  const url =
    firstSet(process.env.TURSO_DATABASE_URL, process.env.DATABASE_URL) ??
    'file:./dev.db'

  const adapter = new PrismaLibSql({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
