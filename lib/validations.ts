import { z } from "zod";

// Normalised before it is validated, so callers never have to remember to.
// The address is an identity — User.email's unique index, a rate-limit bucket
// key — and normalising at three separate call sites is three chances for the
// fourth one to be forgotten and let "Ada@example.com" become a second account.
//
// zod's z.email() also checks shape, not size. Uncapped, a 3000-character
// address still parses and then goes on to be a Postgres index key, blowing
// past btree's 2704-byte row limit from inside an unauthenticated form. 254 is
// the RFC 5321 maximum, and it is checked after the trim.
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email("Enter a valid email address.")
      .max(254, "Email must be 254 characters or fewer."),
  );

/** Shared with the client so its `minLength` cannot drift from this schema. */
export const PASSWORD_MIN_LENGTH = 8;
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

export const signupSchema = z.object({
  name: z
    .string()
    .min(1, "Enter your name.")
    .max(100, "Name must be 100 characters or fewer."),
  email: emailField,
  password: passwordField,
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    // Carried in a hidden field from the emailed link.
    token: z.string().min(1, "This reset link is invalid."),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, "Enter your name.")
    .max(100, "Name must be 100 characters or fewer."),
});
