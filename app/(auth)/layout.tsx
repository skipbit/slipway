import Link from "next/link";
import { Sailboat } from "lucide-react";
import { siteConfig } from "@/lib/site";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 text-xl font-bold text-slate-900"
        >
          <Sailboat className="h-6 w-6 text-indigo-600" />
          {siteConfig.name}
        </Link>
        <div className="mt-8 rounded-xl bg-white px-6 py-8 shadow sm:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
