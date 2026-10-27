import { z } from 'zod';

/**
 * Pure rules for the website APK download: what a valid request looks like, how a device is told apart, and how a lead becomes a
 * spreadsheet row. No database here, so all of it is tested directly.
 */

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Spaces, dashes, dots and brackets are removed, so "0803 123-4567" and "+234 803 123 4567" both pass. */
export const normalizePhone = (phone: string) => phone.trim().replace(/[\s\-().]/g, '');

export const downloadRequestSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name').max(80),
  lastName: z.string().trim().min(1, 'Enter your last name').max(80),
  email: z.string().trim().email('Enter a valid email address').max(200),
  phone: z
    .string()
    .transform(normalizePhone)
    .refine((v) => /^\+?\d{7,15}$/.test(v), 'Enter a valid phone number'),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please agree so we can send you the app' }) }),
  /** Honeypot: hidden from people, filled in by bots. */
  website: z.string().optional(),
});
export type DownloadRequest = z.infer<typeof downloadRequestSchema>;

export const releaseInputSchema = z.object({
  version: z.string().trim().min(1, 'Enter a version').max(40),
  url: z
    .string()
    .trim()
    .url('Enter a full link')
    .refine((v) => v.startsWith('https://'), 'The link must start with https://'),
  notes: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type DeviceKind = 'android' | 'ios' | 'desktop' | 'other';

export function detectDevice(userAgent?: string | null): DeviceKind {
  const ua = (userAgent ?? '').toLowerCase();
  if (!ua) return 'other';
  if (ua.includes('android')) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/windows|macintosh|linux|cros/.test(ua)) return 'desktop';
  return 'other';
}

/** A cell that a spreadsheet would run as a formula is prefixed so it stays text. */
function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export interface LeadExportRow {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consent: boolean;
  firstDownloadAt: Date;
  lastDownloadAt: Date | null;
  downloads: number;
}

export const EXPORT_HEADERS = ['First name', 'Last name', 'Email', 'Phone', 'Consented', 'First seen', 'Last download', 'Downloads'] as const;

export function leadToCells(row: LeadExportRow): (string | number)[] {
  return [
    safeCell(row.firstName),
    safeCell(row.lastName),
    safeCell(row.email),
    safeCell(row.phone),
    row.consent ? 'Yes' : 'No',
    row.firstDownloadAt.toISOString(),
    row.lastDownloadAt ? row.lastDownloadAt.toISOString() : '',
    row.downloads,
  ];
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function leadsToCsv(rows: LeadExportRow[]): string {
  const lines = [EXPORT_HEADERS as readonly string[], ...rows.map(leadToCells)].map((cells) => cells.map(csvCell).join(','));
  // The byte-order mark makes Excel read names with accents correctly.
  return '﻿' + lines.join('\r\n') + '\r\n';
}
