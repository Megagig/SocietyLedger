// ============================================
// PHASE 3.5: NIGERIAN PAYMENT FEATURES CONTROLLER
// ============================================

import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { nigerianPaymentsService } from './nigerian-payments.service';
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
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
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

      const account = await nigerianPaymentsService.updateBankAccount(parseInt(id), associationId, data);

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
        message: 'Bank account updated successfully',
        data: account,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
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

      await nigerianPaymentsService.deleteBankAccount(parseInt(id), associationId);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'DELETE',
          tableName: 'association_bank_accounts',
          recordId: parseInt(id),
          oldValues: existing,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Bank account deleted successfully',
      });
    } catch (error) {
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

      // Check for duplicate reference
      const existing = await prisma.bankTransfer.findFirst({
        where: { associationId, reference: data.reference },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'A bank transfer with this reference already exists',
        });
      }

      const transfer = await nigerianPaymentsService.createBankTransfer(associationId, data);

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
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
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
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
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
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error verifying bank transfer:', error);
      return res.status(500).json({ success: false, message: 'Failed to verify bank transfer' });
    }
  },

  // ==========================================
  // BANK STATEMENT IMPORT ENDPOINTS (TASK-PAY-005)
  // ==========================================

  async importBankStatement(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const data = importStatementSchema.parse(req.body);

      // Verify bank account exists
      const bankAccount = await prisma.associationBankAccount.findFirst({
        where: { id: data.bankAccountId, associationId },
      });

      if (!bankAccount) {
        return res.status(404).json({ success: false, message: 'Bank account not found' });
      }

      const result = await nigerianPaymentsService.importBankStatement(associationId, req.user!.id, data);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'IMPORT',
          tableName: 'bank_statement_imports',
          recordId: result.import.id,
          newValues: { filename: data.filename, entriesCreated: result.entriesCreated },
        },
      });

      return res.status(201).json({
        success: true,
        message: `Bank statement imported successfully with ${result.entriesCreated} entries`,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error importing bank statement:', error);
      return res.status(500).json({ success: false, message: 'Failed to import bank statement' });
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
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error reconciling payment:', error);
      return res.status(500).json({ success: false, message: 'Failed to reconcile payment' });
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
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error confirming reconciliation:', error);
      return res.status(500).json({ success: false, message: 'Failed to confirm reconciliation' });
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
      console.error('Error auto-matching transactions:', error);
      return res.status(500).json({ success: false, message: 'Failed to auto-match transactions' });
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
      console.error('Error applying auto-matches:', error);
      return res.status(500).json({ success: false, message: 'Failed to apply auto-matches' });
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

      // Handle file upload (assuming file is already uploaded and we have the path)
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, message: 'File is required' });
      }

      const proof = await nigerianPaymentsService.uploadPaymentProof(associationId, member.id, {
        transactionId: data.transactionId,
        bankTransferId: data.bankTransferId,
        filename: file.originalname,
        filepath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        notes: data.notes,
      });

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'UPLOAD',
          tableName: 'payment_proofs',
          recordId: proof.id,
          newValues: { filename: file.originalname, transactionId: data.transactionId },
        },
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

      return res.status(200).json({
        success: true,
        message: `Payment proof ${data.status.toLowerCase()} successfully`,
        data: proof,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
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
      });

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

      const proof = await nigerianPaymentsService.getPaymentProofById(parseInt(id), associationId);

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
