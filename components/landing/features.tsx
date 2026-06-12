import {
  Bot,
  Database,
  Gauge,
  LayoutDashboard,
  Lock,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    name: "Authentication, done",
    description:
      "Email/password and Google OAuth via Auth.js v5, with secure JWT sessions and protected routes.",
    icon: Lock,
  },
  {
    name: "AI-first workspace",
    description:
      "CLAUDE.md, specialized agents, and slash commands ship in the repo — Claude Code follows your conventions from the first prompt.",
    icon: Bot,
  },
  {
    name: "Dashboard shell",
    description:
      "A responsive app shell with sidebar navigation and a settings page, ready to extend with your own pages.",
    icon: LayoutDashboard,
  },
  {
    name: "Type-safe database",
    description:
      "Prisma ORM with SQLite for instant local dev — switch one line to run Postgres in production.",
    icon: Database,
  },
  {
    name: "Modern stack",
    description:
      "Next.js App Router, React Server Components, Server Actions, Tailwind CSS v4, TypeScript strict mode.",
    icon: Gauge,
  },
  {
    name: "Secure by default",
    description:
      "Two-layer route protection, bcrypt password hashing, and zod validation on every Server Action.",
    icon: ShieldCheck,
  },
];

export function Features() {
  return (
    <section id="features" className="bg-slate-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600">
            Everything included
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            The boring parts, already built
          </p>
          <p className="mt-4 text-lg text-slate-600">
            Weeks of setup work compressed into a starter you can deploy today.
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.name}
              className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
            >
              <feature.icon className="h-6 w-6 text-indigo-600" />
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {feature.name}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
