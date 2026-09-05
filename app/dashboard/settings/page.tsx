import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, isGoogleConfigured } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { connectErrorMessage } from "@/lib/auth-errors";
import { GOOGLE_NOT_CONFIGURED } from "@/lib/site";
import { canDisconnect } from "@/lib/auth-policy";
import { cn, firstParam, formatDate } from "@/lib/utils";
import {
  DeleteAccountForm,
  ProfileForm,
} from "@/components/dashboard/settings-forms";
import { ConnectedAccounts } from "@/components/dashboard/connected-accounts";
import { VerifyEmailNotice } from "@/components/dashboard/verify-email-notice";
import { ErrorMessage, SuccessMessage } from "@/components/ui/message";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  // `?connected=google` is where connectGoogleAction lands; `?error=` is an
  // Auth.js failure forwarded from /login, which is where pages.error points.
  searchParams: Promise<{
    connected?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const justConnected = firstParam(params.connected) === "google";
  const connectError = firstParam(params.error);
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      createdAt: true,
      // Read only to answer "is password one of your sign-in methods".
      passwordHash: true,
      accounts: { select: { provider: true } },
    },
  });
  if (!user) redirect("/login");

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

      {!user.emailVerified && <VerifyEmailNotice email={user.email} />}

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-slate-900">Account</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex gap-4">
            <dt className="w-36 flex-none text-slate-500">Email</dt>
            <dd className="text-slate-900">
              {user.email}{" "}
              <span
                className={cn(
                  "ml-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  user.emailVerified
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-800",
                )}
              >
                {user.emailVerified ? "Confirmed" : "Not confirmed"}
              </span>
            </dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-36 flex-none text-slate-500">Password</dt>
            <dd className="text-slate-900">
              {user.passwordHash ? "Set" : "Not set"}
            </dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-36 flex-none text-slate-500">Member since</dt>
            <dd className="text-slate-900">{formatDate(user.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-slate-900">
          Connected accounts
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Sign in with a provider as well as, or instead of, your password.
        </p>
        {justConnected && (
          <SuccessMessage className="mt-4">Google connected.</SuccessMessage>
        )}
        {connectError && (
          <ErrorMessage className="mt-4">
            {connectErrorMessage(connectError)}
          </ErrorMessage>
        )}

        <div className="mt-6">
          {isGoogleConfigured() ? (
            <ConnectedAccounts
              connected={user.accounts.some((a) => a.provider === "google")}
              removable={canDisconnect(user, "google")}
            />
          ) : (
            // Rendered here rather than inside the client component so an
            // install without Google credentials — the boilerplate's default —
            // doesn't hydrate one to show a single static line.
            <p className="text-sm text-slate-400" title={GOOGLE_NOT_CONFIGURED}>
              Google — not configured
            </p>
          )}
        </div>
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
