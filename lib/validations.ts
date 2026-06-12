import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const signupSchema = z.object({
  name: z
    .string()
    .min(1, "Enter your name.")
    .max(100, "Name must be 100 characters or fewer."),
  email: z.email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password must be 128 characters or fewer."),
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, "Enter your name.")
    .max(100, "Name must be 100 characters or fewer."),
});
