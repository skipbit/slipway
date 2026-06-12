const faqs = [
  {
    question: "Is Slipway really free?",
    answer:
      "Yes. This edition is MIT licensed — use it for personal and commercial projects, no attribution required. A paid Pro edition with production billing, end-to-end tests, and 12 months of updates is available separately (see the README).",
  },
  {
    question: "What do I need to run it?",
    answer:
      "Node.js 20+ and npm. The local database is SQLite, so there is nothing else to install — clone, set one secret, and you are running in minutes.",
  },
  {
    question: "What makes it AI-first?",
    answer:
      "The repo ships with a Claude Code workspace: CLAUDE.md documents the architecture and conventions, specialized agents review code and handle schema changes, and slash commands scaffold new pages and models. Your AI pair programmer is productive from the first prompt.",
  },
  {
    question: "Can I take it to production?",
    answer:
      "Yes. Switch the Prisma datasource from SQLite to Postgres, set your environment variables, and deploy to any Node.js host — Vercel works out of the box.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
          Frequently asked questions
        </h2>
        <dl className="mt-12 space-y-8">
          {faqs.map((faq) => (
            <div
              key={faq.question}
              className="rounded-xl bg-slate-50 p-6 ring-1 ring-slate-200"
            >
              <dt className="text-base font-semibold text-slate-900">
                {faq.question}
              </dt>
              <dd className="mt-2 text-sm leading-6 text-slate-600">
                {faq.answer}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
