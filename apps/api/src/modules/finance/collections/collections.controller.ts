import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../lib/prisma';
import { RuleError } from '../rule-error';
import { collectionsService } from './collections.service';
import { toExcel, toPdf } from './collection-export';
import { SETTLEMENT_FILTERS } from './settlement';

const exportQuerySchema = z.object({
  screen: z.enum(['levy-campaign', 'donations', 'penalties', 'member-ledger']),
  id: z.coerce.number().int().positive().optional(),
  allocationId: z.coerce.number().int().positive().optional(),
  status: z.enum(SETTLEMENT_FILTERS).default('all'),
  search: z.string().trim().max(100).optional(),
  format: z.enum(['xlsx', 'pdf']),
});

const FILE_NAMES = { 'levy-campaign': 'levy-campaign', donations: 'donations', penalties: 'penalties', 'member-ledger': 'member-ledgers' } as const;

function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
  if (error instanceof RuleError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
}

export const collectionsController = {
  /** GET /api/finance/collections/export?screen=…&status=…&search=…&format=xlsx|pdf: the filtered list as a file, built here and sent straight back. */
  async exportFile(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId || !req.user) return res.status(400).json({ success: false, message: 'Association ID is required' });
      const q = exportQuerySchema.parse(req.query);
      const doc = await collectionsService.build(associationId, { screen: q.screen, id: q.id, allocationId: q.allocationId, status: q.status, search: q.search });
      const file = q.format === 'xlsx' ? await toExcel(doc) : await toPdf(doc);
      await prisma.auditLog
        .create({
          data: {
            associationId,
            userId: req.user.id,
            action: 'EXPORT',
            tableName: 'collections',
            newValues: { screen: q.screen, id: q.id ?? null, status: q.status, search: q.search ?? null, format: q.format, rows: doc.rows.length },
          },
        })
        .catch((error: unknown) => console.error('Audit log failed (non-critical):', error));
      const day = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', q.format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${FILE_NAMES[q.screen]}-${q.status}-${day}.${q.format}"`);
      return res.send(file);
    } catch (error) {
      return fail(res, error, 'Failed to create the export');
    }
  },

  /** GET /api/finance/collections/members/:memberId/open-charges: what the member still owes, for the Record payment dialog. */
  async openCharges(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId || !req.user) return res.status(400).json({ success: false, message: 'Association ID is required' });
      const memberId = parseInt(req.params.memberId, 10);
      if (!Number.isInteger(memberId)) return res.status(400).json({ success: false, message: 'Member is required' });
      return res.json({ success: true, data: await collectionsService.openCharges(associationId, memberId, req.user.id) });
    } catch (error) {
      return fail(res, error, 'Failed to get the open charges');
    }
  },
};
