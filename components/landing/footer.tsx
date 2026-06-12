import Link from "next/link";
import { Sailboat } from "lucide-react";
import { siteConfig } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-12 sm:flex-row lg:px-8">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Sailboat className="h-4 w-4 text-indigo-600" />
          {siteConfig.name}
        </div>
        <div className="flex gap-6 text-sm text-slate-500">
          <Link href="/#features" className="hover:text-slate-900">
            Features
          </Link>
          <Link href="/#faq" className="hover:text-slate-900">
            FAQ
          </Link>
          <Link href="/login" className="hover:text-slate-900">
            Log in
          </Link>
        </div>
        <p className="text-sm text-slate-400">
          © {new Date().getFullYear()} {siteConfig.name}. MIT licensed.
        </p>
      </div>
    </footer>
  );
}
