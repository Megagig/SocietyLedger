// ============================================
// PHASE 3.5: NIGERIAN PAYMENT FEATURES CONTROLLER
// ============================================

import { Request, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import { PlatformRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { PERMISSIONS } from '../../lib/permissions';
import { uploadFile, getPresignedUrl } from '../../lib/storage';
import { RBACService } from '../../services/rbac.service';
import { notifyProofDecided, notifyProofSubmitted, notifyTransferRecorded } from '../../services/payment-proof-notifications';
import { BANK_RULE_STATUS, BankRuleError } from './bank-rules';
import { nigerianPaymentsService, ReconciliationDecisionError } from './nigerian-payments.service';
import { RuleError } from '../finance/rule-error';
import { importStatement, parseMappingInput, previewStatement } from './statement-import';
import { suggestMatches } from './reconciliation-engine';
import { PROOF_DECISION_STATUS, ProofDecisionError } from './payment-proof-decision';
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  createBankTransferSchema,
  updateBankTransferSchema,
  verifyBankTransferSchema,
  importStatementSchema,
  reconcilePaymentSchema,
  confirmReconciliationSchema,
  uploadPaymentProofSchema,
  verifyPaymentProofSchema,
  bankAccountQuerySchema,
  bankTransferQuerySchema,
  statementEntryQuerySchema,
  reconciliationQuerySchema,
  paymentProofQuerySchema,
} from './nigerian-payments.validation';
import { NIGERIAN_BANKS } from './nigerian-payments.types';

/**
 * The proof a caller may fetch the file of. The route lets members in (payments.view_own), so this is where "own" is enforced:
 * officers (payments.view) get any proof in the association, everyone else only the ones they submitted. Without it, any
 * member could read any other member's receipt just by counting proof ids.
 */
async function findProofFileForCaller(req: Request, id: number, associationId: number) {
  const proof = await prisma.paymentProof.findFirst({ where: { id, associationId } });
  if (!proof || !req.user) return null;

  const isOfficer =
    req.user.platformRole === PlatformRole.SUPER_ADMIN ||
    (await RBACService.hasAnyPermission(
      { userId: req.user.id, associationId: req.user.associationId ?? null, platformRole: req.user.platformRole ?? null },
      [PERMISSIONS.PAYMENT_VIEW],
    ));
  if (isOfficer) return proof;

  return req.user.memberId !== undefined && proof.memberId === req.user.memberId ? proof : null;
}

/** A broken rule keeps its status and code; a bad request is a 400; a decided match is a 409; anything else is logged and a 500. */
function reconFailure(res: Response, error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.errors[0]?.message ?? 'Validation error', errors: error.errors });
  if (error instanceof RuleError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  if (error instanceof ReconciliationDecisionError) return res.status(409).json({ success: false, code: 'ALREADY_DECIDED', message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
}

/** The file and choices of an import request (multipart: file, bankAccountId, and optionally mapping and headerRow). */
function statementRequest(req: Request) {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw new RuleError('Choose a CSV or Excel statement to upload.', 400, 'NO_FILE');
  const bankAccountId = parseInt(String(req.body?.bankAccountId ?? ''), 10);
  if (!Number.isInteger(bankAccountId) || bankAccountId <= 0) throw new RuleError('Choose the bank account this statement is for.', 400, 'NO_ACCOUNT');
  const headerRow = req.body?.headerRow !== undefined && req.body.headerRow !== '' ? parseInt(String(req.body.headerRow), 10) : null;
  return {
    bankAccountId,
    filename: path.basename(file.originalname),
    buffer: file.buffer,
    manualMapping: parseMappingInput(req.body?.mapping),
    headerRow: headerRow !== null && Number.isInteger(headerRow) && headerRow >= 0 ? headerRow : null,
  };
}

export const nigerianPaymentsController = {
  // ==========================================
  // BANK ACCOUNT ENDPOINTS (TASK-PAY-002)
  // ==========================================

  async listBankAccounts(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const query = bankAccountQuerySchema.parse(req.query);
      const isActive = query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined;

      const accounts = await nigerianPaymentsService.getBankAccounts(associationId, isActive);

      return res.status(200).json({
        success: true,
        data: { bankAccounts: accounts },
      });
    } catch (error) {
      console.error('Error listing bank accounts:', error);
      return res.status(500).json({ success: false, message: 'Failed to list bank accounts' });
    }
  },

  async getBankAccountById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const account = await nigerianPaymentsService.getBankAccountById(parseInt(id), associationId);

      if (!account) {
        return res.status(404).json({ success: false, message: 'Bank account not found' });
      }

      return res.status(200).json({
        success: true,
        data: account,
      });
    } catch (error) {
      console.error('Error fetching bank account:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch bank account' });
    }
  },

  async createBankAccount(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const data = createBankAccountSchema.parse(req.body);

      // Check for duplicate account number
      const existing = await prisma.associationBankAccount.findFirst({
        where: { associationId, accountNumber: data.accountNumber },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'A bank account with this account number already exists',
        });
      }

      const account = await nigerianPaymentsService.createBankAccount(associationId, data);

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'CREATE',
          tableName: 'association_bank_accounts',
          recordId: account.id,
          newValues: account,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Bank account created successfully',
        data: account,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Validation error', errors: error.errors });
      }
      console.error('Error creating bank account:', error);
      return res.status(500).json({ success: false, message: 'Failed to create bank account' });
    }
  },

  async updateBankAccount(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const data = updateBankAccountSchema.parse(req.body);

      const existing = await prisma.associationBankAccount.findFirst({
        where: { id: parseInt(id), associationId },
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Bank account not found' });
      }

      const { account, newDefaultId } = await nigerianPaymentsService.updateBankAccount(parseInt(id), associationId, data);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'UPDATE',
          tableName: 'association_bank_accounts',
          recordId: account.id,
          oldValues: existing,
          newValues: account,
        },
      });

      return res.status(200).json({
        success: true,
        message: newDefaultId ? 'Bank account updated. Another account is now the default.' : 'Bank account updated successfully',
        data: { ...account, newDefaultId },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Validation error', errors: error.errors });
      }
      if (error instanceof BankRuleError) {
        return res.status(BANK_RULE_STATUS[error.code]).json({ success: false, code: error.code, message: error.message });
      }
      console.error('Error updating bank account:', error);
      return res.status(500).json({ success: false, message: 'Failed to update bank account' });
    }
  },

  async deleteBankAccount(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const existing = await prisma.associationBankAccount.findFirst({
        where: { id: parseInt(id), associationId },
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Bank account not found' });
      }

      const { outcome, newDefaultId } = await nigerianPaymentsService.deleteBankAccount(parseInt(id), associationId);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'DELETE',
          tableName: 'association_bank_accounts',
          recordId: parseInt(id),
          oldValues: existing,
          newValues: { outcome, newDefaultId },
        },
      });

      return res.status(200).json({
        success: true,
        // A used account keeps its history, so it is deactivated rather than deleted — say which happened.
        message: outcome === 'deactivated' ? 'Bank account deactivated. Its transfers and statements are kept.' : 'Bank account deleted successfully',
        data: { outcome, newDefaultId },
      });
    } catch (error) {
      if (error instanceof BankRuleError) {
        return res.status(BANK_RULE_STATUS[error.code]).json({ success: false, code: error.code, message: error.message });
      }
      console.error('Error deleting bank account:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete bank account' });
    }
  },

  async getNigerianBanks(req: Request, res: Response) {
    return res.status(200).json({
      success: true,
      data: { banks: NIGERIAN_BANKS },
    });
  },


  // ==========================================
  // BANK TRANSFER ENDPOINTS (TASK-PAY-001)
  // ==========================================

  async listBankTransfers(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const query = bankTransferQuerySchema.parse(req.query);
      const page = parseInt(query.page);
      const limit = parseInt(query.limit);

      const result = await nigerianPaymentsService.getBankTransfers(associationId, {
        page,
        limit,
        status: query.status,
        memberId: query.memberId ? parseInt(query.memberId) : undefined,
        bankAccountId: query.bankAccountId ? parseInt(query.bankAccountId) : undefined,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        search: query.search,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error listing bank transfers:', error);
      return res.status(500).json({ success: false, message: 'Failed to list bank transfers' });
    }
  },

  async getBankTransferById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const transfer = await nigerianPaymentsService.getBankTransferById(parseInt(id), associationId);

      if (!transfer) {
        return res.status(404).json({ success: false, message: 'Bank transfer not found' });
      }

      return res.status(200).json({
        success: true,
        data: transfer,
      });
    } catch (error) {
      console.error('Error fetching bank transfer:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch bank transfer' });
    }
  },

  async createBankTransfer(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const data = createBankTransferSchema.parse(req.body);

      // The service checks the links belong to this association and that the reference is free (ignoring case and spaces).
      const transfer = await nigerianPaymentsService.createBankTransfer(associationId, data, req.user!.id);

      // Officers who can verify are told one is waiting — fire-and-forget.
      void notifyTransferRecorded(associationId, {
        id: transfer.id,
        recorderUserId: req.user!.id,
        amount: transfer.amount.toString(),
        reference: transfer.reference,
      });

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'CREATE',
          tableName: 'bank_transfers',
          recordId: transfer.id,
          newValues: transfer,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Bank transfer recorded successfully',
        data: transfer,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Validation error', errors: error.errors });
      }
      if (error instanceof BankRuleError) {
        return res.status(BANK_RULE_STATUS[error.code]).json({ success: false, code: error.code, message: error.message });
      }
      console.error('Error creating bank transfer:', error);
      return res.status(500).json({ success: false, message: 'Failed to record bank transfer' });
    }
  },

  async updateBankTransfer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const data = updateBankTransferSchema.parse(req.body);

      const existing = await prisma.bankTransfer.findFirst({
        where: { id: parseInt(id), associationId },
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Bank transfer not found' });
      }

      if (existing.status !== 'PENDING') {
        return res.status(400).json({
          success: false,
          message: 'Cannot update a verified or matched bank transfer',
        });
      }

      const transfer = await nigerianPaymentsService.updateBankTransfer(parseInt(id), associationId, data);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'UPDATE',
          tableName: 'bank_transfers',
          recordId: transfer.id,
          oldValues: existing,
          newValues: transfer,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Bank transfer updated successfully',
        data: transfer,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Validation error', errors: error.errors });
      }
      if (error instanceof BankRuleError) {
        return res.status(BANK_RULE_STATUS[error.code]).json({ success: false, code: error.code, message: error.message });
      }
      console.error('Error updating bank transfer:', error);
      return res.status(500).json({ success: false, message: 'Failed to update bank transfer' });
    }
  },

  async verifyBankTransfer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const data = verifyBankTransferSchema.parse(req.body);

      const existing = await prisma.bankTransfer.findFirst({
        where: { id: parseInt(id), associationId },
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Bank transfer not found' });
      }

      const transfer = await nigerianPaymentsService.verifyBankTransfer(
        parseInt(id),
        associationId,
        req.user!.id,
        data.status,
        data.notes
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'VERIFY',
          tableName: 'bank_transfers',
          recordId: transfer.id,
          oldValues: existing,
          newValues: transfer,
        },
      });

      return res.status(200).json({
        success: true,
        message: `Bank transfer ${data.status.toLowerCase()} successfully`,
        data: transfer,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Validation error', errors: error.errors });
      }
      if (error instanceof BankRuleError) {
        return res.status(BANK_RULE_STATUS[error.code]).json({ success: false, code: error.code, message: error.message });
      }
      console.error('Error verifying bank transfer:', error);
      return res.status(500).json({ success: false, message: 'Failed to verify bank transfer' });
    }
  },

  // ==========================================
  // BANK STATEMENT IMPORT ENDPOINTS (TASK-PAY-005)
  // ==========================================

  /** POST /import-statement/preview — what an import would do, without saving anything. */
  async previewStatement(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });
      const data = await previewStatement(associationId, statementRequest(req));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return reconFailure(res, error, 'Failed to read the statement');
    }
  },

  /** POST /import-statement — saves the new lines of an uploaded CSV or Excel statement. */
  async importBankStatement(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });

      const input = statementRequest(req);
      const result = await importStatement(associationId, req.user!.id, input);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'IMPORT',
          tableName: 'bank_statement_imports',
          recordId: result.import.id,
          newValues: { filename: input.filename, entriesCreated: result.entriesCreated, alreadyImported: result.alreadyImported },
        },
      });

      return res.status(201).json({
        success: true,
        message: `Imported ${result.entriesCreated} lines${result.alreadyImported > 0 ? `, skipped ${result.alreadyImported} already imported` : ''}`,
        data: result,
      });
    } catch (error) {
      return reconFailure(res, error, 'Failed to import bank statement');
    }
  },

  /** GET /reconciliation/suggestions — each unmatched bank line with the charge it most likely paid, and how sure that is. */
  async getMatchSuggestions(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });
      return res.status(200).json({ success: true, data: await suggestMatches(associationId) });
    } catch (error) {
      return reconFailure(res, error, 'Failed to find matches');
    }
  },

  async listStatementImports(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await nigerianPaymentsService.getStatementImports(associationId, page, limit);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error listing statement imports:', error);
      return res.status(500).json({ success: false, message: 'Failed to list statement imports' });
    }
  },

  async listStatementEntries(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const query = statementEntryQuerySchema.parse(req.query);
      const page = parseInt(query.page);
      const limit = parseInt(query.limit);

      const result = await nigerianPaymentsService.getStatementEntries(associationId, {
        page,
        limit,
        importId: query.importId ? parseInt(query.importId) : undefined,
        matchStatus: query.matchStatus,
        creditsOnly: query.creditsOnly === 'true',
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error listing statement entries:', error);
      return res.status(500).json({ success: false, message: 'Failed to list statement entries' });
    }
  },


  // ==========================================
  // RECONCILIATION ENDPOINTS (TASK-PAY-003)
  // ==========================================

  async reconcilePayment(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const data = reconcilePaymentSchema.parse(req.body);

      const reconciliation = await nigerianPaymentsService.reconcilePayment(associationId, req.user!.id, data);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'RECONCILE',
          tableName: 'payment_reconciliations',
          recordId: reconciliation.id,
          newValues: reconciliation,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Payment reconciled successfully',
        data: reconciliation,
      });
    } catch (error) {
      return reconFailure(res, error, 'Failed to reconcile payment');
    }
  },

  async confirmReconciliation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const data = confirmReconciliationSchema.parse(req.body);

      const existing = await prisma.paymentReconciliation.findFirst({
        where: { id: parseInt(id), associationId },
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Reconciliation not found' });
      }

      const reconciliation = await nigerianPaymentsService.confirmReconciliation(
        parseInt(id),
        associationId,
        req.user!.id,
        data.status,
        data.notes
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'CONFIRM_RECONCILIATION',
          tableName: 'payment_reconciliations',
          recordId: reconciliation.id,
          oldValues: existing,
          newValues: reconciliation,
        },
      });

      return res.status(200).json({
        success: true,
        message: `Reconciliation ${data.status.toLowerCase()} successfully`,
        data: reconciliation,
      });
    } catch (error) {
      return reconFailure(res, error, 'Failed to confirm reconciliation');
    }
  },

  async listReconciliations(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const query = reconciliationQuerySchema.parse(req.query);
      const page = parseInt(query.page);
      const limit = parseInt(query.limit);

      const result = await nigerianPaymentsService.getReconciliations(associationId, {
        page,
        limit,
        status: query.status,
        matchType: query.matchType,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error listing reconciliations:', error);
      return res.status(500).json({ success: false, message: 'Failed to list reconciliations' });
    }
  },

  // ==========================================
  // AUTO-MATCHING ENDPOINTS (TASK-PAY-004)
  // ==========================================

  async autoMatchTransactions(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const result = await nigerianPaymentsService.autoMatchTransactions(associationId);

      return res.status(200).json({
        success: true,
        message: `Found ${result.matched} potential matches`,
        data: result,
      });
    } catch (error) {
      return reconFailure(res, error, 'Failed to auto-match transactions');
    }
  },

  async applyAutoMatches(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const { matches } = req.body;

      if (!matches || !Array.isArray(matches) || matches.length === 0) {
        return res.status(400).json({ success: false, message: 'Matches array is required' });
      }

      const results = await nigerianPaymentsService.applyAutoMatches(associationId, req.user!.id, matches);

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'AUTO_MATCH',
          tableName: 'payment_reconciliations',
          newValues: { successful, failed, total: matches.length },
        },
      });

      return res.status(200).json({
        success: true,
        message: `Applied ${successful} matches, ${failed} failed`,
        data: { results, successful, failed },
      });
    } catch (error) {
      return reconFailure(res, error, 'Failed to apply auto-matches');
    }
  },

  // ==========================================
  // PAYMENT PROOF ENDPOINTS (TASK-PAY-007, TASK-PAY-008)
  // ==========================================

  async uploadPaymentProof(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      // Get member ID from user
      const member = await prisma.member.findFirst({
        where: { userId: req.user!.id, associationId },
      });

      if (!member) {
        return res.status(400).json({ success: false, message: 'Member not found for this user' });
      }

      const data = uploadPaymentProofSchema.parse(req.body);

      // R7.2 (G17): a Bank Transfer declaration needs a real file; this endpoint is
      // reached for other methods too (via the transactionIds array), where a
      // declarationNote stands in for the file instead.
      const file = req.file;
      if (!file && !data.declarationNote) {
        return res.status(400).json({
          success: false,
          message: 'Either a receipt file or a written declaration of the payment is required',
        });
      }

      // Upload the file buffer to MinIO. The returned key is stored in the DB;
      // the server's local disk is never written to.
      let storageKey: string | undefined;
      if (file?.buffer) {
        const ext = path.extname(file.originalname) || '';
        storageKey = `payment-proofs/${associationId}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        await uploadFile(storageKey, file.buffer, file.mimetype);
      }

      // R7.2 (G17): confirm every declared transaction actually belongs to this
      // member and is genuinely outstanding — without this, any member could
      // submit a proof for someone else's transaction.
      if (data.transactionIds && data.transactionIds.length > 0) {
        const owned = await prisma.transaction.count({
          where: {
            id: { in: data.transactionIds },
            memberId: member.id,
            associationId,
            status: { in: ['pending', 'overdue', 'partial'] },
          },
        });
        if (owned !== data.transactionIds.length) {
          return res.status(400).json({
            success: false,
            message: 'Some transactions were not found, already paid, or do not belong to you',
          });
        }
      }

      const proof = await nigerianPaymentsService.uploadPaymentProof(associationId, member.id, {
        transactionId: data.transactionId,
        transactionIds: data.transactionIds,
        bankTransferId: data.bankTransferId,
        paymentMethod: data.paymentMethod || (file ? 'bank_transfer' : undefined),
        filename: file?.originalname,
        filepath: storageKey,   // MinIO object key, not a local path
        fileSize: file?.size,
        mimeType: file?.mimetype,
        declarationNote: data.declarationNote,
        notes: data.notes,
      });

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'UPLOAD',
          tableName: 'payment_proofs',
          recordId: proof.id,
          newValues: { filename: file?.originalname, transactionId: data.transactionId, transactionIds: data.transactionIds },
        },
      });

      // Officers who can verify proofs are told one is waiting — fire-and-forget.
      void notifyProofSubmitted(associationId, {
        id: proof.id,
        memberUserId: req.user!.id,
        memberName: `${proof.member.firstName} ${proof.member.lastName}`.trim(),
      });

      return res.status(201).json({
        success: true,
        message: 'Payment proof uploaded successfully',
        data: proof,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error uploading payment proof:', error);
      return res.status(500).json({ success: false, message: 'Failed to upload payment proof' });
    }
  },

  async verifyPaymentProof(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const data = verifyPaymentProofSchema.parse(req.body);

      const existing = await prisma.paymentProof.findFirst({
        where: { id: parseInt(id), associationId },
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Payment proof not found' });
      }

      const proof = await nigerianPaymentsService.verifyPaymentProof(
        parseInt(id),
        associationId,
        req.user!.id,
        data
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'VERIFY',
          tableName: 'payment_proofs',
          recordId: proof.id,
          oldValues: existing,
          newValues: proof,
        },
      });

      // Tell the member how it went (with the reason, if rejected) — fire-and-forget.
      void notifyProofDecided(associationId, proof);

      return res.status(200).json({
        success: true,
        message: `Payment proof ${data.status.toLowerCase()} successfully`,
        data: proof,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Validation error', errors: error.errors });
      }
      if (error instanceof ProofDecisionError) {
        return res.status(PROOF_DECISION_STATUS[error.code]).json({ success: false, code: error.code, message: error.message });
      }
      console.error('Error verifying payment proof:', error);
      return res.status(500).json({ success: false, message: 'Failed to verify payment proof' });
    }
  },

  async listPaymentProofs(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const query = paymentProofQuerySchema.parse(req.query);
      const page = parseInt(query.page);
      const limit = parseInt(query.limit);

      const result = await nigerianPaymentsService.getPaymentProofs(associationId, {
        page,
        limit,
        status: query.status,
        memberId: query.memberId ? parseInt(query.memberId) : undefined,
        transactionId: query.transactionId ? parseInt(query.transactionId) : undefined,
      }, req.hostname);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error listing payment proofs:', error);
      return res.status(500).json({ success: false, message: 'Failed to list payment proofs' });
    }
  },

  async getPaymentProofById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const proof = await nigerianPaymentsService.getPaymentProofById(parseInt(id), associationId, req.hostname);

      if (!proof) {
        return res.status(404).json({ success: false, message: 'Payment proof not found' });
      }

      return res.status(200).json({
        success: true,
        data: proof,
      });
    } catch (error) {
      console.error('Error fetching payment proof:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch payment proof' });
    }
  },

  async downloadPaymentProof(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const proof = await findProofFileForCaller(req, parseInt(id), associationId);

      if (!proof) {
        return res.status(404).json({ success: false, message: 'Payment proof not found' });
      }

      if (!proof.filepath) {
        return res.status(404).json({ success: false, message: 'No file attached to this proof' });
      }

      // Generate a 1-hour presigned URL and redirect the browser directly to MinIO.
      // The file is never proxied through the API server — MinIO streams it directly.
      const url = await getPresignedUrl(proof.filepath, undefined, req.hostname);
      return res.redirect(url);
    } catch (error) {
      console.error('Error generating download URL:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate download URL' });
    }
  },

  /**
   * GET /proofs/:id/file-url — the same short-lived link as /download, but as JSON, for clients (the mobile app) that can't follow
   * a redirect with their auth header. Officers get any proof in the association; a member only their own.
   */
  async getPaymentProofFileUrl(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const proof = await findProofFileForCaller(req, parseInt(req.params.id), associationId);
      if (!proof) {
        return res.status(404).json({ success: false, message: 'Payment proof not found' });
      }
      if (!proof.filepath) {
        return res.status(404).json({ success: false, message: 'No file attached to this proof' });
      }

      const expiresInSeconds = 3600;
      const url = await getPresignedUrl(proof.filepath, expiresInSeconds, req.hostname);
      return res.status(200).json({
        success: true,
        data: { url, filename: proof.filename, mimeType: proof.mimeType, expiresInSeconds },
      });
    } catch (error) {
      console.error('Error generating proof file link:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate the file link' });
    }
  },

  // ==========================================
  // UNMATCHED PAYMENTS DASHBOARD (TASK-PAY-006)
  // ==========================================

  async getUnmatchedPaymentsDashboard(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const dashboard = await nigerianPaymentsService.getUnmatchedPaymentsDashboard(associationId);

      return res.status(200).json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      console.error('Error fetching unmatched payments dashboard:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
    }
  },
};
