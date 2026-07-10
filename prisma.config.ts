import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 moved the datasource connection URL out of schema.prisma and no
 * longer auto-loads .env for the config file, so we load it ourselves. The CLI
 * (`prisma db push`, `prisma migrate`, `prisma studio`) reads the URL from here;
 * the application connects via the libSQL driver adapter in src/lib/db.ts.
 *
 * .env.local is loaded first so it overrides .env, matching Next.js precedence
 * (dotenv never overwrites a variable that is already set).
 */
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
})
