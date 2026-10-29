/**
 * HTTP layer for the Circle board (spec §16.4). Thin: who may see what is decided in ajo-board.service.ts. A circle's members and its
 * officers may read; the service answers "not found" to anyone else and BOARD_NOT_AVAILABLE for a collector-thrift scheme.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../lib/permissions';
import { accountabilityCsv, getAccountability } from './ajo-accountability.service';
import { getNoticePreferences, setNoticePreferences } from './ajo-circle-notices.service';
import { makeCircleStatement } from './ajo-circle-statement';
import { boardActivity, boardArrears, boardMatrix, boardMembers, boardMetrics, boardOverview, boardPayouts, boardRound, type BoardViewer } from './ajo-board.service';
import { actor, fail, hasAjoPermission } from './ajo-members.controller';

const id = z.coerce.number().int().positive();

async function viewerOf(req: Request): Promise<{ associationId: number; groupId: number; viewer: BoardViewer }> {
  const { userId, associationId } = actor(req);
  const [manage, reconcile, approve] = await Promise.all([hasAjoPermission(req, PERMISSIONS.AJO_MANAGE), hasAjoPermission(req, PERMISSIONS.AJO_RECONCILE), hasAjoPermission(req, PERMISSIONS.AJO_APPROVE_PAYOUT)]);
  return { associationId, groupId: id.parse(req.params.id), viewer: { userId, isOfficer: manage || reconcile || approve } };
}

const send = (res: Response, data: unknown) => res.json({ success: true, data });

export const ajoBoardController = {
  async overview(req: Request, res: Response) {
    try {
      return send(res, await boardOverview(await viewerOf(req)));
    } catch (error) {
      return fail(res, error, 'Could not load the circle board.');
    }
  },
  async round(req: Request, res: Response) {
    try {
      const filter = z.enum(['ALL', 'PAID', 'NOT_PAID']).optional().parse(req.query.filter);
      return send(res, await boardRound({ ...(await viewerOf(req)), round: id.parse(req.params.round), filter }));
    } catch (error) {
      return fail(res, error, 'Could not load that round.');
    }
  },
  async matrix(req: Request, res: Response) {
    try {
      return send(res, await boardMatrix(await viewerOf(req)));
    } catch (error) {
      return fail(res, error, 'Could not load the payment history.');
    }
  },
  async payouts(req: Request, res: Response) {
    try {
      return send(res, await boardPayouts(await viewerOf(req)));
    } catch (error) {
      return fail(res, error, 'Could not load the payouts.');
    }
  },
  async members(req: Request, res: Response) {
    try {
      return send(res, await boardMembers(await viewerOf(req)));
    } catch (error) {
      return fail(res, error, 'Could not load the members.');
    }
  },
  async arrears(req: Request, res: Response) {
    try {
      return send(res, await boardArrears(await viewerOf(req)));
    } catch (error) {
      return fail(res, error, 'Could not load the arrears.');
    }
  },
  async metrics(req: Request, res: Response) {
    try {
      return send(res, await boardMetrics(await viewerOf(req)));
    } catch (error) {
      return fail(res, error, 'Could not load the figures.');
    }
  },
  /** A member's own choices about which circle notifications they get. Everything is on except the weekly summary. */
  async getPreferences(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      res.setHeader('Cache-Control', 'no-store');
      return send(res, await getNoticePreferences(associationId, userId));
    } catch (error) {
      return fail(res, error, 'Could not load your notification choices.');
    }
  },
  async setPreferences(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const body = z.object({ roundFunded: z.boolean().optional(), payoutRecorded: z.boolean().optional(), yourTurn: z.boolean().optional(), weeklySummary: z.boolean().optional() }).strict().parse(req.body ?? {});
      return send(res, await setNoticePreferences(associationId, userId, body));
    } catch (error) {
      return fail(res, error, 'Could not save your notification choices.');
    }
  },

  /** Officers only: separation of duties, the confirmation backlog, cash by collector and day, and exceptions with their reasons. */
  async accountability(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      res.setHeader('Cache-Control', 'no-store');
      return send(res, await getAccountability({ associationId, groupId: id.parse(req.params.id) }));
    } catch (error) {
      return fail(res, error, 'Could not load the accountability report.');
    }
  },
  async accountabilityExport(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const now = new Date();
      const report = await getAccountability({ associationId, groupId: id.parse(req.params.id), now });
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="accountability-${now.toISOString().slice(0, 10)}.csv"`);
      return res.send(accountabilityCsv(report, now));
    } catch (error) {
      return fail(res, error, 'Could not make the report.');
    }
  },

  /** The circle statement as a PDF: the same figures as the board, with a code that checks it against the live record. */
  async statement(req: Request, res: Response) {
    try {
      const v = await viewerOf(req);
      const { file, name } = await makeCircleStatement({ ...v, verifyBaseUrl: process.env.FRONTEND_URL });
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      return res.send(file);
    } catch (error) {
      return fail(res, error, 'Could not make the circle statement.');
    }
  },
  async activity(req: Request, res: Response) {
    try {
      const q = z.object({ limit: z.coerce.number().int().min(1).max(100).optional(), before: z.string().datetime().optional() }).parse(req.query);
      return send(res, await boardActivity({ ...(await viewerOf(req)), limit: q.limit, before: q.before ? new Date(q.before) : undefined }));
    } catch (error) {
      return fail(res, error, 'Could not load the circle activity.');
    }
  },
};
