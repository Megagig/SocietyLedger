/**
 * HTTP layer for a collector-thrift saver's own view (spec §16.6): savings, calendar, payments, where the cash is, collector, record, and
 * the statement and receipt files. Only the saver themselves, or an officer, may read these; everyone else is told the membership does
 * not exist.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { PERMISSIONS } from '../../lib/permissions';
import { RuleError } from '../finance/rule-error';
import { actor, canManage, fail, hasAjoPermission } from './ajo-members.controller';
import { getCashTracker, getCollectorInfo, getPayments, getRecord, getSavings } from './ajo-savings.service';
import { buildStatement, receiptPdf, statementCsv, statementFileName, statementPdf } from './ajo-savings-statement';

const id = z.coerce.number().int().positive();

/** The saver themselves or an officer. A collector assigned to them is deliberately not enough: this is the saver's own record. */
async function assertOwnerOrOfficer(req: Request, membershipId: number): Promise<{ associationId: number; userId: number; officer: boolean }> {
  const { userId, associationId } = actor(req);
  const m = await prisma.ajoMembership.findFirst({ where: { id: membershipId, associationId }, select: { member: { select: { userId: true } } } });
  if (!m) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  const officer = (await canManage(req)) || (await hasAjoPermission(req, PERMISSIONS.AJO_RECONCILE)) || (await hasAjoPermission(req, PERMISSIONS.AJO_APPROVE_PAYOUT));
  if (m.member.userId !== userId && !officer) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  return { associationId, userId, officer };
}

const own =
  <T>(label: string, load: (associationId: number, membershipId: number) => Promise<T>) =>
  async (req: Request, res: Response) => {
    try {
      const membershipId = id.parse(req.params.id);
      const { associationId } = await assertOwnerOrOfficer(req, membershipId);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, data: await load(associationId, membershipId) });
    } catch (error) {
      return fail(res, error, `Could not load ${label}.`);
    }
  };

export const ajoSavingsController = {
  savings: own('your savings', (associationId, membershipId) => getSavings({ associationId, membershipId })),
  payments: own('your payments', (associationId, membershipId) => getPayments({ associationId, membershipId })),
  cash: own('where your cash is', (associationId, membershipId) => getCashTracker({ associationId, membershipId })),
  collector: own('your collector', (associationId, membershipId) => getCollectorInfo({ associationId, membershipId })),
  record: own('your record', (associationId, membershipId) => getRecord({ associationId, membershipId })),

  async statement(req: Request, res: Response) {
    try {
      const membershipId = id.parse(req.params.id);
      const { associationId } = await assertOwnerOrOfficer(req, membershipId);
      const format = z.enum(['pdf', 'csv']).default('pdf').parse(req.query.format);
      const data = await buildStatement({ associationId, membershipId });
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Disposition', `attachment; filename="${statementFileName(data, format)}"`);
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        return res.send(statementCsv(data));
      }
      res.setHeader('Content-Type', 'application/pdf');
      return res.send(await statementPdf(data));
    } catch (error) {
      return fail(res, error, 'Could not make the statement.');
    }
  },

  async receipt(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const officer = (await canManage(req)) || (await hasAjoPermission(req, PERMISSIONS.AJO_RECONCILE));
      const { file, name } = await receiptPdf({ associationId, contributionId: id.parse(req.params.id), viewerUserId: userId, viewerIsOfficer: officer });
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      return res.send(file);
    } catch (error) {
      return fail(res, error, 'Could not make the receipt.');
    }
  },
};
