import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import prisma from '../../lib/prisma';
import { detectDevice, leadsToCsv, leadToCells, EXPORT_HEADERS, normalizeEmail, type DownloadRequest, type LeadExportRow } from './app-download.rules';

export class NoReleaseError extends Error {}

function searchFilter(search?: string): Prisma.DownloadLeadWhereInput {
  if (!search) return {};
  return {
    OR: [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ],
  };
}

export const AppDownloadService = {
  /** The version people are offered right now, or null when nothing is published. */
  async currentRelease() {
    return prisma.appRelease.findFirst({ where: { isCurrent: true, isActive: true }, select: { id: true, version: true, url: true, notes: true } });
  },

  /** Saves the person (one row per email), logs the hand-out and returns the link. */
  async submit(input: DownloadRequest, userAgent?: string | null) {
    const release = await AppDownloadService.currentRelease();
    if (!release) throw new NoReleaseError('The app is not available for download yet.');
    const email = normalizeEmail(input.email);
    const now = new Date();
    const lead = await prisma.downloadLead.upsert({
      where: { email },
      create: { email, firstName: input.firstName, lastName: input.lastName, phone: input.phone, consent: true, consentedAt: now },
      update: { firstName: input.firstName, lastName: input.lastName, phone: input.phone, consent: true, consentedAt: now },
    });
    await prisma.downloadEvent.create({ data: { leadId: lead.id, releaseId: release.id, device: detectDevice(userAgent) } });
    return { url: release.url, version: release.version };
  },

  listReleases() {
    return prisma.appRelease.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { downloads: true } } } });
  },

  createRelease(data: { version: string; url: string; notes?: string | null; isActive?: boolean }) {
    return prisma.appRelease.create({ data: { version: data.version, url: data.url, notes: data.notes ?? null, isActive: data.isActive ?? true } });
  },

  async updateRelease(id: number, data: { version?: string; url?: string; notes?: string | null; isActive?: boolean }) {
    // Turning the current release off would leave the page with nothing to serve, so it stops being current.
    return prisma.appRelease.update({ where: { id }, data: data.isActive === false ? { ...data, isCurrent: false } : data });
  },

  /** Exactly one release is current: the others are cleared in the same transaction. */
  async setCurrent(id: number) {
    return prisma.$transaction(async (tx) => {
      const release = await tx.appRelease.findUnique({ where: { id } });
      if (!release) return null;
      if (!release.isActive) throw new Error('Turn the release on before making it current.');
      await tx.appRelease.updateMany({ where: { isCurrent: true, NOT: { id } }, data: { isCurrent: false } });
      return tx.appRelease.update({ where: { id }, data: { isCurrent: true } });
    });
  },

  /** A release that was ever handed out stays in the history: it can be turned off but not deleted. */
  async deleteRelease(id: number) {
    const used = await prisma.downloadEvent.count({ where: { releaseId: id } });
    if (used > 0) return { deleted: false as const, reason: 'This release has downloads, so it is kept in the history. Turn it off instead.' };
    await prisma.appRelease.delete({ where: { id } });
    return { deleted: true as const };
  },

  async listLeads(params: { search?: string; page: number; pageSize: number }) {
    const where = searchFilter(params.search);
    const [total, leads] = await Promise.all([
      prisma.downloadLead.count({ where }),
      prisma.downloadLead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          _count: { select: { downloads: true } },
          downloads: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, release: { select: { version: true } } } },
        },
      }),
    ]);
    return {
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
      leads: leads.map((l) => ({
        id: l.id,
        firstName: l.firstName,
        lastName: l.lastName,
        email: l.email,
        phone: l.phone,
        consent: l.consent,
        createdAt: l.createdAt,
        downloads: l._count.downloads,
        lastDownloadAt: l.downloads[0]?.createdAt ?? null,
        lastVersion: l.downloads[0]?.release.version ?? null,
      })),
    };
  },

  async exportRows(search?: string): Promise<LeadExportRow[]> {
    const leads = await prisma.downloadLead.findMany({
      where: searchFilter(search),
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { downloads: true } }, downloads: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } } },
    });
    return leads.map((l) => ({
      firstName: l.firstName,
      lastName: l.lastName,
      email: l.email,
      phone: l.phone,
      consent: l.consent,
      firstDownloadAt: l.createdAt,
      lastDownloadAt: l.downloads[0]?.createdAt ?? null,
      downloads: l._count.downloads,
    }));
  },

  async exportCsv(search?: string) {
    return leadsToCsv(await AppDownloadService.exportRows(search));
  },

  async exportXlsx(search?: string): Promise<Buffer> {
    const rows = await AppDownloadService.exportRows(search);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Leads');
    ws.addRow([...EXPORT_HEADERS]).font = { bold: true };
    rows.forEach((r) => ws.addRow(leadToCells(r)));
    ws.columns.forEach((c) => (c.width = 22));
    return Buffer.from(await wb.xlsx.writeBuffer());
  },

  async analytics(days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [totalLeads, totalDownloads, newLeads, byRelease, byDevice, perDay, repeat, current] = await Promise.all([
      prisma.downloadLead.count(),
      prisma.downloadEvent.count(),
      prisma.downloadLead.count({ where: { createdAt: { gte: since } } }),
      prisma.appRelease.findMany({ orderBy: { createdAt: 'desc' }, select: { version: true, isCurrent: true, _count: { select: { downloads: true } } } }),
      prisma.downloadEvent.groupBy({ by: ['device'], _count: { _all: true }, where: { createdAt: { gte: since } } }),
      prisma.$queryRaw<{ day: Date; downloads: bigint }[]>`
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS downloads
        FROM download_events WHERE created_at >= ${since} GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ repeaters: bigint }[]>`
        SELECT COUNT(*) AS repeaters FROM (SELECT lead_id FROM download_events GROUP BY lead_id HAVING COUNT(*) > 1) t`,
      AppDownloadService.currentRelease(),
    ]);
    const repeatPeople = Number(repeat[0]?.repeaters ?? 0);
    const downloadsInRange = byDevice.reduce((n, d) => n + d._count._all, 0);
    // Days with no downloads still get a point, so the chart has no gaps.
    const map = new Map(perDay.map((d) => [d.day.toISOString().slice(0, 10), Number(d.downloads)]));
    const series: { date: string; downloads: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      series.push({ date, downloads: map.get(date) ?? 0 });
    }
    return {
      rangeDays: days,
      currentVersion: current?.version ?? null,
      totalLeads,
      totalDownloads,
      newLeads,
      downloadsInRange,
      repeatPeople,
      firstTimePeople: Math.max(0, totalLeads - repeatPeople),
      byRelease: byRelease.map((r) => ({ version: r.version, isCurrent: r.isCurrent, downloads: r._count.downloads })),
      byDevice: byDevice.map((d) => ({ device: d.device, downloads: d._count._all })),
      series,
    };
  },
};
