---
description: Run the full pre-commit verification suite (lint, types, unit tests, build) and report
---

Run the verification suite for this repo and report the results:

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm run test`
4. `npm run build`

Rules:

- Run them in that order and do not stop at the first failure — collect all
  failures so they can be fixed in one pass.
- If anything fails, list each failure with file:line and propose the fix;
  apply fixes only if I asked you to, then re-run the failed step.
- If everything passes, reply with a short PASS summary (one line per step).
- If `prisma/schema.prisma` changed since the last build, run
  `npx prisma generate` first to avoid stale client types.
- The Playwright smoke run (`npm run test:e2e`) is not part of this fast gate —
  it needs a browser (`npx playwright install chromium`) and boots the app. CI
  runs it in a separate job; run it locally when you touch the public pages.
