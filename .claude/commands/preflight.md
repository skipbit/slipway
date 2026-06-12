---
description: Run the full pre-commit verification suite (lint, types, build) and report
---

Run the verification suite for this repo and report the results:

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm run build`

Rules:

- Run them in that order and do not stop at the first failure — collect all
  failures so they can be fixed in one pass.
- If anything fails, list each failure with file:line and propose the fix;
  apply fixes only if I asked you to, then re-run the failed step.
- If everything passes, reply with a short PASS summary (one line per step).
- If `prisma/schema.prisma` changed since the last build, run
  `npx prisma generate` first to avoid stale client types.
