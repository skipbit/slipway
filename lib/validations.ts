import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/utils";

// Normalised before it is validated, so callers never have to remember to.
// The address is an identity — User.email's unique index, a rate-limit bucket
// key — and normalising at three separate call sites is three chances for the
// fourth one to be forgotten and let "Ada@example.com" become a second account.
//
// z.email() also checks shape, not size, and an address has a size: 254 is the
// RFC 5321 maximum, checked after the trim. Framing this as "how long an
// address may be" rather than "what our index can hold" matters — the storage
// bound belongs to rateLimit(), which owns the key, and stating it here once
// cost this branch a second, separate discovery of the same class of bug.
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email("Enter a valid email address.")
      .max(254, "Email must be 254 characters or fewer."),
  );

const PASSWORD_MAX_LENGTH = 128;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password."),
});

// One definition of "an acceptable password", shared by signup and reset so the
// two can never drift into accepting different things.
const passwordField = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  )
  .max(
    PASSWORD_MAX_LENGTH,
    `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`,
  );

const nameField = z
  .string()
  .min(1, "Enter your name.")
  .max(100, "Name must be 100 characters or fewer.");

export const signupSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

/**
 * A token that came back from an emailed link.
 *
 * Capped because the value is whatever the client posted, and it goes on to be
 * hashed and bound into a query on an unauthenticated route. Ours are 43
 * characters of base64url; 200 leaves room without leaving the door open.
 */
function emailTokenField(message: string) {
  return z.string().min(1, message).max(200, message);
}

export const verifyEmailSchema = z.object({
  token: emailTokenField("This confirmation link is invalid."),
});

export const resetPasswordSchema = z
  .object({
    // Carried in a hidden field from the emailed link.
    token: emailTokenField("This reset link is invalid."),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  name: nameField,
});
