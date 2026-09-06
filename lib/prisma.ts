// Importing this from a client component is a mistake that used to surface as
// `Module not found: Can't resolve 'dns'` from deep inside pg, at build time,
// naming nothing useful. `server-only` turns it into an error that names this
// module and the file that reached for it.
import "server-only";

import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 is Rust-engine-free and requires a driver adapter. The pg adapter
// owns its own connection pool, built from DATABASE_URL. Fail fast with a clear
// message if it's unset — otherwise pg silently falls back to localhost defaults
// and only errors later with a confusing ECONNREFUSED.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set — copy .env.example to .env and set it (see README).",
  );
}
const adapter = new PrismaPg({ connectionString });

// Avoid creating a new client on every hot reload in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
