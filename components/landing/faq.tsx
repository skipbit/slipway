const faqs = [
  {
    question: "Is Slipway really free?",
    answer:
      "Yes — completely. Slipway is a single MIT-licensed edition: use it for personal and commercial projects, no attribution required. No paid tier, no upsell.",
  },
  {
    question: "What do I need to run it?",
    answer:
      "Just Docker with Compose. Postgres and the app start together with a single command — clone, set one secret, and you are running in minutes. Prefer the host? Node.js 22+ works too.",
  },
  {
    question: "What makes it AI-first?",
    answer:
      "The repo ships with a Claude Code workspace: CLAUDE.md documents the architecture and conventions, specialized agents review code and handle schema changes, and slash commands scaffold new pages and models. Your AI pair programmer is productive from the first prompt.",
  },
  {
    question: "Can I take it to production?",
    answer:
      "Yes. It runs on Postgres out of the box — point DATABASE_URL at your production database, set your environment variables, and deploy to any Node.js host, or ship the included production Docker Compose stack.",
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
