import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// The boxed messages inside the auth forms, kept here rather than copied per
// form so that surface can't drift into two shades of red.
//
// Scoped to auth on purpose: the dashboard's settings forms use unboxed inline
// text (`text-sm text-red-600`), a different treatment rather than a stray
// copy. Folding those in means adding a variant, not a find-and-replace.

export function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {children}
    </p>
  );
}

export function SuccessMessage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700",
        className,
      )}
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
      {children}
    </p>
  );
}
