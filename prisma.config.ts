// Prisma 7 config. The datasource `url` moved out of prisma/schema.prisma into
// this file; the Prisma CLI (generate, db push, studio) reads the connection
// URL from here. The runtime client connects separately via the pg driver
// adapter in lib/prisma.ts.
//
// `import "dotenv/config"` is required because Prisma's own .env auto-loading is
// disabled once a prisma.config.ts is present — this loads .env for host-side
// CLI runs. In Docker/CI, DATABASE_URL is injected via the environment, so
// dotenv simply finds nothing to load and no-ops.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: env("DATABASE_URL") },
});
