import Link from "next/link";
import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";

// The indigo inline link used throughout the auth flow — six copies of the
// same three classes before this existed.
// ComponentProps<typeof Link>, not LinkProps: the latter covers href/prefetch
// and friends but none of the anchor attributes next/link forwards, so the
// first caller wanting target/rel/aria-label would be pushed back to a raw
// <Link> — the six copies this exists to prevent.
export function TextLink({
  className,
  children,
  ...props
}: ComponentProps<typeof Link>) {
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
