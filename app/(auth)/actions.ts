"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { loginSchema, signupSchema } from "@/lib/validations";

export type AuthFormState = { error: string | null };

// Per-IP throttles for credential auth. Tune to taste — shared NATs mean a
// whole office counts as one caller, so keep these generous enough for humans
// while still blunting brute force.
const LOGIN_LIMIT = { max: 10, windowSeconds: 10 * 60 };
const SIGNUP_LIMIT = { max: 5, windowSeconds: 60 * 60 };

function tooManyAttempts(retryAfterSeconds: number): AuthFormState {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return {
    error: `Too many attempts. Try again in about ${minutes} minute${
      minutes === 1 ? "" : "s"
    }.`,
  };
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const ip = await getClientIp();
  const limit = await rateLimit(
    `login:${ip}`,
    LOGIN_LIMIT.max,
    LOGIN_LIMIT.windowSeconds,
  );
  if (!limit.success) return tooManyAttempts(limit.retryAfterSeconds);

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
    return { error: null };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    // Next.js redirect() throws — let it propagate.
    throw err;
  }
}

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const ip = await getClientIp();
  const limit = await rateLimit(
    `signup:${ip}`,
    SIGNUP_LIMIT.max,
    SIGNUP_LIMIT.windowSeconds,
  );
  if (!limit.success) return tooManyAttempts(limit.retryAfterSeconds);

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists. Log in instead." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: { name: parsed.data.name, email, passwordHash },
  });

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
    return { error: null };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Account created, but sign-in failed. Try logging in." };
    }
    throw err;
  }
}

export async function googleSignInAction() {
  await signIn("google", { redirectTo: "/dashboard" });
}
