/**
 * HTTP layer for the Ajo reports (T10). Thin: what each person may see is decided in report.service.ts. Files are streamed straight back
 * in the response and never stored, so a report with members' names does not sit on disk.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../../lib/permissions';
import type { AjoRequest } from '../ajo-access';
import { actor, fail, hasAjoPermission } from '../ajo-members.controller';
import type { ReportScope } from './report-context';
import { exportReport, listReports, runReport } from './report.service';

/** An officer sees everything in the association; anyone else with the reports permission is a collector and sees only their own people. */
async function scopeOf(req: Request): Promise<ReportScope> {
  const { userId } = actor(req);
  const [manage, reconcile, approve] = await Promise.all([hasAjoPermission(req, PERMISSIONS.AJO_MANAGE), hasAjoPermission(req, PERMISSIONS.AJO_RECONCILE), hasAjoPermission(req, PERMISSIONS.AJO_APPROVE_PAYOUT)]);
  return { userId, collectorOnly: !(manage || reconcile || approve) };
}
const accessOf = (req: Request) => (req as AjoRequest).ajoAccess ?? 'FULL';

const paging = z.object({ page: z.coerce.number().int().min(1).optional(), pageSize: z.coerce.number().int().min(1).max(200).optional() });
const format = z.object({ format: z.enum(['csv', 'pdf']).default('csv') });

export const ajoReportsController = {
  async list(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, data: await listReports({ associationId, access: accessOf(req), scope: await scopeOf(req) }) });
    } catch (error) {
      return fail(res, error, 'Could not load the reports.');
    }
  },

  async run(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const { page, pageSize } = paging.parse(req.query);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, data: await runReport({ associationId, name: req.params.name, query: req.query, scope: await scopeOf(req), access: accessOf(req), page, pageSize }) });
    } catch (error) {
      return fail(res, error, 'Could not make the report.');
    }
  },

  async export(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const { format: fmt } = format.parse(req.query);
      const file = await exportReport({ associationId, name: req.params.name, query: req.query, scope: await scopeOf(req), access: accessOf(req), format: fmt, actorUserId: userId });
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
      return res.send(file.body);
    } catch (error) {
      return fail(res, error, 'Could not make the file.');
    }
  },
};
