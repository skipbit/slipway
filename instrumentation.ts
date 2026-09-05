import { productionConfigProblems } from "@/lib/env";

/**
 * Next.js calls this once per server instance, before the first request.
 *
 * The point is timing: a bad production configuration should stop a deploy,
 * not wait for the first user to try a password reset and get a neutral
 * "check your inbox" for mail that will never arrive.
 */
export function register() {
  // `next build` loads this file too, and builds legitimately run without the
  // runtime environment. Only a starting server is being checked.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const problems = productionConfigProblems(process.env);
  if (problems.length === 0) return;

  console.error(
    `Invalid production configuration:\n${problems
      .map((problem) => `  - ${problem}`)
      .join("\n")}`,
  );

  // Throwing from here is not enough: Next folds it into an unhandled
  // rejection during server preparation, leaving a process that never binds a
  // port — a hang rather than a configuration error, and nothing in the log an
  // operator would look for. Exit so the container fails fast and visibly.
  // (`process.exit` is absent on the edge runtime, where the throw is the best
  // available signal anyway.)
  if (typeof process.exit === "function") process.exit(1);
  throw new Error("Invalid production configuration");
}
