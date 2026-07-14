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
    // `*.test.ts` = Vitest; Playwright uses `e2e/*.spec.ts`. Keeping the
    // suffixes distinct means neither runner ever picks up the other's files.
    include: ["**/*.test.ts"],
    exclude: [...configDefaults.exclude, "e2e/**", ".next/**"],
  },
  // Mirror the `@/*` path alias from tsconfig.json so imports resolve the same
  // way under Vitest as they do in the Next.js build.
  resolve: {
    alias: [{ find: /^@\//, replacement: `${root}/` }],
  },
});
