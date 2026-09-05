import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// The boxed messages that sit inside auth forms. Kept here rather than copied
// per form so the auth surface can't drift into two shades of red.

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
