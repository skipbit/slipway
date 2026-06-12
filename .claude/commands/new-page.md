---
description: Scaffold a new protected dashboard page wired into the sidebar
argument-hint: e.g. "projects — list the user's projects with a create form"
---

Create a new dashboard page: $ARGUMENTS

Follow the existing patterns exactly:

1. Create `app/dashboard/<slug>/page.tsx` as an async Server Component:
   - `auth()` + redirect guard at the top (copy the pattern from
     `app/dashboard/settings/page.tsx`).
   - `export const metadata` with a title.
   - Page header (h1 + description), content in white rounded-xl cards
     (`rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200`).
2. If the page mutates data, add a colocated `actions.ts` (`"use server"`,
   auth check, zod validation in `lib/validations.ts`, `revalidatePath`).
   Interactive forms go in `components/dashboard/` as small client components
   using `useActionState`.
3. Add the nav item to `components/dashboard/sidebar.tsx` with a lucide icon.
4. If it needs new models, follow the db-expert agent workflow
   (schema → `npx prisma db push` → `npx prisma generate`).
5. Verify with `npm run build`.
