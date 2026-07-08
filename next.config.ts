import type { NextConfig } from "next";

/**
 * Next.js Configuration for SynapseLearn
 *
 * Key configuration decisions:
 *
 * 1. output: "standalone"
 *    - Produces a self-contained build with minimal node_modules.
 *    - Required for Vercel deployment and Docker containerization.
 *    - Reduces deployment size by only including necessary dependencies.
 *
 * 2. serverExternalPackages: ['better-sqlite3']
 *    - Excludes better-sqlite3 from webpack bundling on the server.
 *    - better-sqlite3 is a native Node.js addon (C++ binary) used by Prisma
 *      for SQLite database access. Webpack cannot bundle native modules.
 *    - While Vercel doesn't natively support SQLite (it's ephemeral filesystem),
 *      this prevents build-time failures and allows local development to work.
 *    - For production Vercel deployment, consider migrating to a managed
 *      database (PostgreSQL, MySQL) or using Vercel KV/Postgres.
 *
 * 3. reactStrictMode: false
 *    - Disables React strict mode to avoid double-rendering in development.
 *    - Some animations and side effects behave unexpectedly with strict mode.
 *    - Consider re-enabling for production to catch potential issues.
 */
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ['better-sqlite3', '@prisma/adapter-libsql', '@libsql/client'],
  // Multiple lockfiles exist above this directory; pin the workspace root so
  // Next.js/Turbopack stops inferring the wrong one.
  turbopack: {
    root: __dirname,
  },
  reactStrictMode: false,
};

export default nextConfig;