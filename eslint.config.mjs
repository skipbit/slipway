import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import reactPkg from "react/package.json" with { type: "json" };

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Tell eslint-plugin-react which React it is linting instead of letting it
    // auto-detect. Detection walks the filesystem via the `context.getFilename()`
    // API that ESLint 10 removed, so it is the one code path in the plugin that
    // crashes the whole run under ESLint 10 (see PR #46). Reading the version
    // from the installed package keeps version-gated rules — react/no-deprecated
    // and friends — accurate without a literal to maintain.
    settings: { react: { version: reactPkg.version } },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
