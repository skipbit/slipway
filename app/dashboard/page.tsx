import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Dashboard" };

const stats = [
  { name: "Projects", value: "3", hint: "placeholder metric" },
  { name: "API requests (30d)", value: "12,403", hint: "placeholder metric" },
  { name: "Team members", value: "1", hint: "placeholder metric" },
];

const checklist = [
  { label: "Create your account", done: true },
  { label: "Configure Google OAuth in .env (optional)", done: false },
  { label: "Add your first Prisma model (try /add-model)", done: false },
  { label: "Replace these placeholder stats with real data", done: false },
];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Here is an overview of your workspace.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
          >
            <p className="text-sm font-medium text-slate-500">{stat.name}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-slate-400">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-slate-900">
          Getting started
        </h2>
        <ul className="mt-4 space-y-3">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-3 text-sm">
              {item.done ? (
                <CheckCircle2 className="h-5 w-5 flex-none text-emerald-500" />
              ) : (
                <Circle className="h-5 w-5 flex-none text-slate-300" />
              )}
              <span
                className={
                  item.done ? "text-slate-400 line-through" : "text-slate-700"
                }
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
