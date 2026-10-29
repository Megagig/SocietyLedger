/**
 * HTTP layer for the Circle board (spec §16.4). Thin: who may see what is decided in ajo-board.service.ts. A circle's members and its
 * officers may read; the service answers "not found" to anyone else and BOARD_NOT_AVAILABLE for a collector-thrift scheme.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../lib/permissions';
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
  async activity(req: Request, res: Response) {
    try {
      const q = z.object({ limit: z.coerce.number().int().min(1).max(100).optional(), before: z.string().datetime().optional() }).parse(req.query);
      return send(res, await boardActivity({ ...(await viewerOf(req)), limit: q.limit, before: q.before ? new Date(q.before) : undefined }));
    } catch (error) {
      return fail(res, error, 'Could not load the circle activity.');
    }
  },
};
