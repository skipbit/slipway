import Link, { type LinkProps } from "next/link";
import { cn } from "@/lib/utils";

// The indigo inline link used throughout the auth flow — six copies of the
// same three classes before this existed.
export function TextLink({
  className,
  children,
  ...props
}: LinkProps & { className?: string; children: React.ReactNode }) {
  return (
    <Link
      className={cn(
        "font-semibold text-indigo-600 hover:text-indigo-500",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
