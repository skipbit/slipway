import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

// Unit tests only — pure logic in `lib/` (validations, utils, rate-limit).
// UI and integration flows are covered by Playwright (see playwright.config.ts),
// so we stay on the fast `node` environment and skip jsdom entirely.
export default defineConfig({
  test: {
    environment: "node",
    // Vitest owns `*.test.ts`; Playwright owns `e2e/*.spec.ts` (and pins its own
    // testMatch to `*.spec.ts`). Excluding e2e/ here keeps the runners disjoint
    // even if a `*.test.ts` were ever colocated with the browser specs.
    include: ["**/*.test.ts"],
    exclude: [...configDefaults.exclude, "e2e/**", ".next/**"],
  },
  // Mirror the `@/*` path alias from tsconfig.json so imports resolve the same
  // way under Vitest as they do in the Next.js build.
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${root}/` },
      // `server-only` marks lib/auth.ts and lib/prisma.ts as off-limits to the
      // browser. It works by resolving to a module that throws unless the
      // `react-server` export condition is set, which Vitest does not set — so
      // without this a unit test importing either of them fails on the marker
      // rather than on anything it was testing. Stubbing it here is narrower
      // than turning that condition on for the whole run.
      { find: /^server-only$/, replacement: `${root}/test/server-only-stub.ts` },
    ],
  },
});
