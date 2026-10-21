import { z } from 'zod';

/** A4 — mirrors the API's own `loginSchema` (auth.controller.ts): email format, password just
 * "required" (the server, not the client, is the source of truth on password strength for an
 * existing account — this screen is signing in, not choosing a new one). */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

/** A6 — the API's `verifyEmailSchema` requires exactly 6 digits. */
export const otpSchema = z.object({
  code: z.string().length(6, 'Enter the 6-digit code'),
});

export type OtpFormValues = z.infer<typeof otpSchema>;

/** A5 — mirrors the API's `selfRegisterSchema` (member-invites.controller.ts): `password` at
 * least 6 characters (the server's own minimum); `confirmPassword`/`acceptTerms` are
 * client-only fields, never sent to the API. */
export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Enter your first name'),
    lastName: z.string().trim().min(1, 'Enter your last name'),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    password: z.string().min(6, 'Must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
    acceptTerms: z.boolean().refine((value) => value === true, { message: 'You must accept the terms to continue' }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

/** A7 */
export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

/** A8/A9 — shared "choose a new password" shape (reset password, accept invite). */
export const newPasswordSchema = z
  .object({
    password: z.string().min(6, 'Must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type NewPasswordFormValues = z.infer<typeof newPasswordSchema>;
