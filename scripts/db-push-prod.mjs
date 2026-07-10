/**
 * Push the Prisma schema to the production Turso database.
 *
 * The Prisma CLI cannot connect to libsql:// URLs (P1013), so `prisma db push`
 * only ever updates the local file DB. This script closes that gap:
 *
 *   1. Mirror Turso's current schema into a temporary local SQLite file.
 *   2. Ask `prisma migrate diff` for the SQL that brings it up to schema.prisma.
 *   3. Apply that SQL to Turso through the libsql client.
 *
 * Usage:  npm run db:push:prod
 * Reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from .env / .env.local.
 */
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createClient } from '@libsql/client'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
if (!url) {
  console.error('TURSO_DATABASE_URL is not set — nothing to push to.')
  process.exit(1)
}

const turso = createClient({ url, authToken })
const shadowDir = mkdtempSync(path.join(tmpdir(), 'turso-shadow-'))
const shadowPath = path.join(shadowDir, 'shadow.db')

try {
  // 1. Recreate Turso's current schema in a local shadow DB the CLI can read
  const master = await turso.execute(
    "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'"
  )
  const shadow = createClient({ url: `file:${shadowPath}` })
  for (const row of master.rows) await shadow.execute(row.sql)
  shadow.close()
  console.log(`Turso currently has ${master.rows.length} schema objects.`)

  // 2. Diff shadow (= Turso today) against schema.prisma. Prisma 7 removed
  //    --from-url, so the shadow URL rides in via the config-file override.
  const schemaPath = path.join('prisma', 'schema.prisma')
  const diff = execSync(
    `npx prisma migrate diff --from-config-datasource --to-schema "${schemaPath}" --script`,
    {
      encoding: 'utf8',
      env: { ...process.env, PRISMA_CLI_URL_OVERRIDE: `file:${shadowPath}` },
    }
  )

  const statements = diff
    .split(/;\s*\n/)
    .map((s) => s.replace(/^--.*$/gm, '').trim())
    .filter(Boolean)

  if (statements.length === 0) {
    console.log('Turso is already in sync with schema.prisma — nothing to do.')
  } else {
    // 3. Apply to Turso
    console.log(`Applying ${statements.length} statement(s) to Turso:`)
    for (const stmt of statements) {
      console.log(`  ${stmt.split('\n')[0].slice(0, 100)}${stmt.includes('\n') ? ' …' : ''}`)
      await turso.execute(stmt)
    }
    console.log('Done — Turso schema now matches schema.prisma.')
  }
} finally {
  turso.close()
  // Best-effort: Windows can briefly hold a lock on the shadow DB file
  try {
    rmSync(shadowDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
  } catch {}
}
