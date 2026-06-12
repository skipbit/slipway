import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu blur-3xl"
      >
        <div className="mx-auto aspect-[1155/678] w-[72rem] bg-gradient-to-tr from-indigo-200 to-sky-100 opacity-60 [clip-path:polygon(74%_44%,100%_61%,97%_26%,85%_0,80%_2%,72%_32%,60%_62%,52%_68%,47%_58%,45%_34%,27%_76%,0_64%,17%_100%,27%_76%,76%_97%,74%_44%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-24 pt-20 sm:pt-28 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
            The AI-first SaaS boilerplate — free &amp; MIT licensed
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Ship your SaaS,
            <span className="text-indigo-600"> not boilerplate</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Slipway gives you authentication, a clean dashboard, and a type-safe
            database out of the box — plus a ready-made Claude Code workspace,
            so your AI pair programmer knows the codebase from the first
            prompt.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              Try the live demo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/#features"
              className="rounded-lg px-5 py-3 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              See what&apos;s inside
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
