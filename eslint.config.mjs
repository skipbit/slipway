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
    // `useActionState` fixes the shape of a form action at (prevState,
    // formData), so an action that needs neither still has to declare both.
    // The codebase already names those `_prev` / `_formData`; this makes the
    // convention mean something to the linter instead of leaving warnings that
    // everyone learns to scroll past.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Auth.js's own docs show this option on providers, so the natural way to
      // add GitHub or Discord is to copy an example that carries it. It signs a
      // visitor into whatever account already holds their email address, which
      // is an account takeover; linking belongs in connectGoogleAction, from a
      // session. A comment on the Google provider only guards the Google
      // provider — this guards the repository.
      "no-restricted-syntax": [
        "error",
        {
          // Both key forms: `{ allowDangerous...: true }` is an Identifier key,
          // `{ "allowDangerous...": true }` a Literal, and a selector matching
          // only the first is a guard with a documented promise it does not keep.
          selector:
            "Property[key.name='allowDangerousEmailAccountLinking'], Property[key.value='allowDangerousEmailAccountLinking']",
          message:
            "Don't enable allowDangerousEmailAccountLinking — it signs users into an account that merely shares their email address. Link providers from an authenticated session instead (app/dashboard/actions.ts#connectGoogleAction); see the Google provider note in lib/auth.ts.",
        },
      ],
    },
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
