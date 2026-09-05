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

  // Throw rather than process.exit(). Exiting reads better on a long-lived
  // container, but on serverless `register()` runs inside a request invocation
  // with no deploy to stop: exiting tears that invocation down mid-flight, can
  // take the console.error above with it, and repeats per cold start as an
  // unattributable 500. Throwing degrades predictably in both — Next reports
  // the message, and a container is left with a server that never binds a port,
  // which its health check fails.
  throw new Error("Invalid production configuration; see the log above.");
}
