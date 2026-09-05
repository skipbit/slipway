import { z } from "zod";

// zod's z.email() checks shape, not size. Uncapped, a 3000-character address
// still parses and then goes on to be a Postgres index key — RateLimit's
// primary key ("forgot:email:<address>") and User.email's unique index both
// blow past btree's 2704-byte row limit and throw from inside an
// unauthenticated form. 254 is the RFC 5321 maximum.
const emailField = z
  .email("Enter a valid email address.")
  .max(254, "Email must be 254 characters or fewer.");

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password."),
});

// One definition of "an acceptable password", shared by signup and reset so the
// two can never drift into accepting different things.
const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be 128 characters or fewer.");

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
