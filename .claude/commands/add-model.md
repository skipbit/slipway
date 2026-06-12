---
description: Add a Prisma model and wire it through the stack (schema, db push, typed queries)
argument-hint: e.g. "Project — name, description, belongs to User"
---

Add a database model: $ARGUMENTS

Use the db-expert agent workflow:

1. Design the model in `prisma/schema.prisma` following the house
   conventions:
   - `id String @id @default(cuid())`
   - `createdAt DateTime @default(now())` / `updatedAt DateTime @updatedAt`
   - user-owned data: `userId` + relation with `onDelete: Cascade`, and add
     the back-relation field on `User`.
   - SQLite limits: no enums (String + a TS union type), no `@db.` native
     types. Keep it portable to Postgres.
2. Apply and regenerate: `npx prisma db push && npx prisma generate`.
3. If the model needs input validation (forms/actions), add a zod schema to
   `lib/validations.ts` now so later features reuse it.
4. Verify with `npx tsc --noEmit`.
5. Summarize: the final model definition, and suggest the natural next step
   (usually `/new-page` to give it a dashboard page).
