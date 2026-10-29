/**
 * HTTP layer for collector-thrift cycles (spec §16.5). Thin: the rules are in ajo-cycle.service.ts. A saver may set their own amount and
 * answer for themselves; an officer may do either on their behalf (it is recorded as done by an officer). Starting the next cycle is the
 * admin's decision, the same permission that approves payouts.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { decideCycleEnd, getCycleView, getGroupCycle, setSaverAmount, startNextCycle } from './ajo-cycle.service';
import { actor, assertSelfOrManager, fail } from './ajo-members.controller';

const id = z.coerce.number().int().positive();
const kobo = z.union([z.number().int().positive(), z.string().regex(/^[0-9]+$/)]).transform((v) => BigInt(v));

export const ajoCycleController = {
  async setAmount(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const membershipId = id.parse(req.params.id);
      await assertSelfOrManager(req, membershipId);
      const body = z.object({ amountKobo: kobo }).parse(req.body);
      return res.json({ success: true, data: await setSaverAmount({ associationId, membershipId, amountKobo: body.amountKobo, actorUserId: userId }) });
    } catch (error) {
      return fail(res, error, 'Could not set the amount.');
    }
  },

  async view(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const membershipId = id.parse(req.params.id);
      await assertSelfOrManager(req, membershipId);
      return res.json({ success: true, data: await getCycleView({ associationId, membershipId }) });
    } catch (error) {
      return fail(res, error, 'Could not load your savings cycle.');
    }
  },

  async decide(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const membershipId = id.parse(req.params.id);
      await assertSelfOrManager(req, membershipId);
      const body = z.object({ choice: z.enum(['WITHDRAW', 'CONTINUE']), nextAmountKobo: kobo.optional() }).parse(req.body);
      const own = await prisma.ajoMembership.findFirst({ where: { id: membershipId, associationId }, select: { member: { select: { userId: true } } } });
      const viaOfficer = own?.member.userId !== userId;
      return res.json({ success: true, data: await decideCycleEnd({ associationId, membershipId, choice: body.choice, nextAmountKobo: body.nextAmountKobo, actorUserId: userId, viaOfficer }) });
    } catch (error) {
      return fail(res, error, 'Could not save your choice.');
    }
  },

  async group(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      return res.json({ success: true, data: await getGroupCycle({ associationId, groupId: id.parse(req.params.id) }) });
    } catch (error) {
      return fail(res, error, 'Could not load the cycle.');
    }
  },

  async startNext(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      return res.json({ success: true, message: 'The next cycle has started.', data: await startNextCycle({ associationId, groupId: id.parse(req.params.id), actorUserId: userId }) });
    } catch (error) {
      return fail(res, error, 'Could not start the next cycle.');
    }
  },
};
