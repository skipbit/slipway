import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// The form messages, in two treatments: boxed for the auth cards, inline for
// the dashboard's denser forms. Kept here rather than copied per form so the
// two surfaces can't drift into different shades of red — which they had,
// along with an error announced as `role="status"`.

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

/**
 * The same two tones without the box, for the dashboard's denser forms.
 *
 * Added because the alternative was a third hand-rolled status paragraph, and
 * the two that already existed had drifted into different reds and — worse —
 * one of them announced errors with `role="status"`, which a screen reader
 * treats as a polite update rather than something that needs attention.
 */
export function InlineMessage({
  tone,
  children,
  className,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "text-sm",
        tone === "error" ? "text-red-700" : "text-emerald-700",
        className,
      )}
    >
      {children}
    </p>
  );
}
