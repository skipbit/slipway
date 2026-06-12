import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import {
  DeleteAccountForm,
  ProfileForm,
} from "@/components/dashboard/settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { accounts: { select: { provider: true } } },
  });
  if (!user) redirect("/login");

  const providers = [
    ...(user.passwordHash ? ["password"] : []),
    ...user.accounts.map((a) => a.provider),
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your account information.
        </p>
      </div>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-slate-900">Profile</h2>
        <p className="mt-1 text-sm text-slate-500">
          This name is shown across the dashboard.
        </p>
        <div className="mt-6">
          <ProfileForm defaultName={user.name ?? ""} />
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-slate-900">Account</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex gap-4">
            <dt className="w-36 flex-none text-slate-500">Email</dt>
            <dd className="text-slate-900">{user.email}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-36 flex-none text-slate-500">Sign-in methods</dt>
            <dd className="text-slate-900">{providers.join(", ") || "none"}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-36 flex-none text-slate-500">Member since</dt>
            <dd className="text-slate-900">{formatDate(user.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-red-200 bg-red-50/50 p-6">
        <h2 className="text-base font-semibold text-red-900">Danger zone</h2>
        <p className="mt-1 text-sm text-red-700">
          Deleting your account removes all of your data. This cannot be
          undone.
        </p>
        <div className="mt-4">
          <DeleteAccountForm />
        </div>
      </section>
    </div>
  );
}
