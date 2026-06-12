import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Sailboat } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { siteConfig } from "@/lib/site";
import { SidebarNav } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authoritative auth check (middleware only does a cheap cookie check).
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold text-slate-900"
          >
            <Sailboat className="h-5 w-5 text-indigo-600" />
            {siteConfig.name}
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-600 sm:block">
              {session.user.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="border-t border-slate-100 px-4 py-2 md:hidden">
          <SidebarNav />
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-6 py-8">
        <aside className="hidden w-56 flex-none md:block">
          <SidebarNav />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
