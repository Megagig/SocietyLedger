// Server-side env (never exposed to client)
export const API_URL = process.env.API_URL ?? 'http://localhost:4000';
export const BASE_DOMAIN = process.env.BASE_DOMAIN ?? 'societyledger.com.ng';

// Public env (safe to expose)
export const NEXT_PUBLIC_ADMIN_HOST =
  process.env.NEXT_PUBLIC_ADMIN_HOST ?? 'http://localhost:3002';
