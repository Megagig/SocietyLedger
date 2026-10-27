import { Router, Response } from 'express';
import { PlatformRole } from '@prisma/client';
import prisma from '../../lib/prisma';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { requirePlatformRole } from '../../middleware/rbac';
import { rateLimit } from '../../middleware/rate-limit.middleware';
import { AppDownloadService, NoReleaseError } from './app-download.service';
import { downloadRequestSchema, releaseInputSchema } from './app-download.rules';

// ============================================
// PUBLIC: mounted at /api/public/app-download
// No sign-in. The link is only ever returned by the POST below, never put in a page.
// ============================================
export const publicRouter: Router = Router();

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  perTenant: false,
  message: 'Too many attempts. Please try again in a few minutes.',
});

/** The version label for the landing page button. No link. */
publicRouter.get('/', async (_req, res: Response) => {
  try {
    const current = await AppDownloadService.currentRelease();
    res.set('Cache-Control', 'public, max-age=30, s-maxage=30');
    res.json({ success: true, data: { available: Boolean(current), version: current?.version ?? null } });
  } catch (error) {
    console.error('Error loading app release:', error);
    res.status(500).json({ success: false, message: 'Could not load the app details' });
  }
});

publicRouter.post('/', submitLimiter, async (req, res: Response) => {
  const parsed = downloadRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Check your details', errors: parsed.error.issues });
  }
  // A person never fills this hidden field. Pretend it worked and hand the bot nothing.
  if (parsed.data.website) return res.json({ success: true, data: { url: null } });
  try {
    const data = await AppDownloadService.submit(parsed.data, req.get('user-agent'));
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof NoReleaseError) return res.status(503).json({ success: false, message: error.message });
    console.error('Error handing out the app link:', error);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// ============================================
// ADMIN: mounted at /api/admin/app-downloads (super admin only)
// ============================================
export const adminRouter: Router = Router();
adminRouter.use(authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN]));

const idOf = (v: string) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

adminRouter.get('/releases', async (_req, res) => {
  res.json({ success: true, data: await AppDownloadService.listReleases() });
});

adminRouter.post('/releases', async (req, res) => {
  const parsed = releaseInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Check the details' });
  res.status(201).json({ success: true, data: await AppDownloadService.createRelease(parsed.data) });
});

adminRouter.put('/releases/:id', async (req, res) => {
  const id = idOf(req.params.id);
  const parsed = releaseInputSchema.partial().safeParse(req.body);
  if (!id || !parsed.success) return res.status(400).json({ success: false, message: parsed.success ? 'Invalid release' : parsed.error.issues[0]?.message });
  try {
    res.json({ success: true, data: await AppDownloadService.updateRelease(id, parsed.data) });
  } catch {
    res.status(404).json({ success: false, message: 'Release not found' });
  }
});

adminRouter.post('/releases/:id/current', async (req, res) => {
  const id = idOf(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid release' });
  try {
    const release = await AppDownloadService.setCurrent(id);
    if (!release) return res.status(404).json({ success: false, message: 'Release not found' });
    res.json({ success: true, data: release });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Could not change the current release' });
  }
});

adminRouter.delete('/releases/:id', async (req, res) => {
  const id = idOf(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid release' });
  const result = await AppDownloadService.deleteRelease(id).catch(() => null);
  if (!result) return res.status(404).json({ success: false, message: 'Release not found' });
  if (!result.deleted) return res.status(409).json({ success: false, message: result.reason });
  res.json({ success: true });
});

adminRouter.get('/leads', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const search = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim() : undefined;
  res.json({ success: true, data: await AppDownloadService.listLeads({ page, pageSize, search }) });
});

adminRouter.get('/leads/export', async (req: AuthRequest, res: Response) => {
  const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
  const search = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim() : undefined;
  const stamp = new Date().toISOString().slice(0, 10);
  // Personal data leaving the system: record who took it.
  await prisma.auditLog
    .create({ data: { userId: req.user!.id, action: 'APP_LEADS_EXPORTED', tableName: 'download_leads', newValues: { format, search: search ?? null } } })
    .catch((e) => console.error('Could not write the export audit entry:', e));
  res.set('Cache-Control', 'no-store');
  if (format === 'xlsx') {
    const buffer = await AppDownloadService.exportXlsx(search);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="app-download-leads-${stamp}.xlsx"` });
    return res.send(buffer);
  }
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="app-download-leads-${stamp}.csv"` });
  res.send(await AppDownloadService.exportCsv(search));
});

adminRouter.get('/analytics', async (req, res) => {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  res.json({ success: true, data: await AppDownloadService.analytics(days) });
});
