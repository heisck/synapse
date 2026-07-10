/**
 * Pushes the Prisma schema to the hosted Turso database.
 *
 * The Prisma CLI cannot talk to `libsql://` URLs directly, so this script
 * renders the schema to SQL with `prisma migrate diff` and applies it over
 * the libSQL client. Statements are `CREATE TABLE` / `CREATE INDEX`, so it
 * is only suitable for an EMPTY database (first deploy). For later schema
 * changes, diff from the deployed state instead of `--from-empty`.
 *
 * Usage: node scripts/db-push-turso.mjs
 * Reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from .env.local / .env.
 */
import { createClient } from '@libsql/client'
import { config } from 'dotenv'
import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

config({ path: '.env.local' })
config({ path: '.env' })

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
if (!url || !url.trim()) {
  console.error('TURSO_DATABASE_URL is not set. Aborting.')
  process.exit(1)
}

const tmp = mkdtempSync(path.join(tmpdir(), 'synapse-schema-'))
const sqlPath = path.join(tmp, 'schema.sql')
try {
  execSync(
    `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script -o "${sqlPath}"`,
    { stdio: 'inherit' },
  )
  const sql = readFileSync(sqlPath, 'utf8')

  const client = createClient({ url, authToken })
  const before = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%'",
  )
  if (before.rows.length > 0) {
    console.error(
      `Database already has tables (${before.rows.map((r) => r.name).join(', ')}).\n` +
        'This script only initializes an empty database. Aborting to avoid conflicts.',
    )
    process.exit(1)
  }

  await client.executeMultiple(sql)
  const after = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  console.log('Schema applied. Tables:', after.rows.map((r) => r.name).join(', '))
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
