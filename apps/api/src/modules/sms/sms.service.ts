/**
 * SMS Service
 * Phase 6.5: SMS & Bulk Communication
 * 
 * Handles all SMS operations including:
 * - Quick SMS sending
 * - Campaign management
 * - Template management
 * - Credit tracking
 * - Automated reminders
 */

import prisma from '../../lib/prisma';
import { 
  sendSMS, 
  sendBulkSMS, 
  getSMSBalance, 
  formatPhoneNumber, 
  isValidPhoneNumber,
  calculateSMSSegments,
  applyMessageTemplate 
} from '../../lib/sms';
import { Prisma, SMSStatus, SMSCampaignStatus, SMSRecipientType, SMSTemplateCategory } from '@prisma/client';
import { SettingsService } from '../settings/settings.service';
import { RuleError } from '../finance/rule-error';
import { dispatchMessages, INLINE_LIMIT, reserveCredits } from './sms-engine';
import { resolveSmsAudience } from './sms-audience';
import { assertCampaignStartable, assertMessageUsable, CAMPAIGN_CANCELLABLE, dedupeRecipients, normalizePhone, type Recipient } from './sms-rules';
import {
  QuickSMSData,
  QuickSMSResult,
  CreateCampaignData,
  CreateTemplateData,
  UpdateTemplateData,
  SMSDashboardStats,
  CampaignStats,
  PaymentReminderData,
  MeetingReminderData,
  RecipientFilter,
} from './sms.types';

export class SMSService {
  // ============================================
  // Dashboard & Statistics
  // ============================================

  /**
   * Get SMS dashboard statistics
   */
  async getDashboardStats(associationId: number): Promise<SMSDashboardStats> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get message counts
    const [totalStats, recentMessages, recentCampaigns, creditBalance] = await Promise.all([
      prisma.sMSMessage.groupBy({
        by: ['status'],
        where: { associationId },
        _count: true,
      }),

      prisma.sMSMessage.findMany({
        where: { associationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      prisma.sMSCampaign.findMany({
        where: { associationId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      prisma.sMSCreditBalance.findUnique({
        where: { associationId },
      }),
    ]);

    // Calculate totals
    let totalSent = 0, totalDelivered = 0, totalFailed = 0;
    totalStats.forEach(stat => {
      if (stat.status === 'SENT' || stat.status === 'DELIVERED') totalSent += stat._count;
      if (stat.status === 'DELIVERED') totalDelivered += stat._count;
      if (stat.status === 'FAILED' || stat.status === 'REJECTED') totalFailed += stat._count;
    });

    // Get campaign counts
    const campaignCounts = await prisma.sMSCampaign.groupBy({
      by: ['status'],
      where: { associationId },
      _count: true,
    });

    const totalCampaigns = campaignCounts.reduce((sum, c) => sum + c._count, 0);
    const activeCampaigns = campaignCounts
      .filter(c => c.status === 'IN_PROGRESS' || c.status === 'SCHEDULED')
      .reduce((sum, c) => sum + c._count, 0);

    // Get template count
    const totalTemplates = await prisma.sMSTemplate.count({
      where: { associationId, isActive: true },
    });

    // Get messages by day for last 30 days
    const messagesByDay = await this.getMessagesByDay(associationId, thirtyDaysAgo, now);

    return {
      totalMessagesSent: totalSent,
      totalMessagesDelivered: totalDelivered,
      totalMessagesFailed: totalFailed,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      totalCampaigns,
      activeCampaigns,
      totalTemplates,
      creditBalance: creditBalance ? Number(creditBalance.balance) : 0,
      recentMessages: recentMessages.map(m => ({
        ...m,
        cost: m.cost ? Number(m.cost) : null,
      })),
      recentCampaigns: recentCampaigns.map(c => ({
        ...c,
        recipientFilter: c.recipientFilter as RecipientFilter | null,
      })),
      messagesByDay,
    };
  }

  private async getMessagesByDay(
    associationId: number,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: string; sent: number; delivered: number; failed: number }>> {
    const messages = await prisma.sMSMessage.findMany({
      where: {
        associationId,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        status: true,
        createdAt: true,
      },
    });

    // Group by date
    const byDay: Record<string, { sent: number; delivered: number; failed: number }> = {};
    
    messages.forEach(msg => {
      const date = msg.createdAt.toISOString().split('T')[0];
      if (!byDay[date]) {
        byDay[date] = { sent: 0, delivered: 0, failed: 0 };
      }
      if (msg.status === 'SENT' || msg.status === 'DELIVERED') byDay[date].sent++;
      if (msg.status === 'DELIVERED') byDay[date].delivered++;
      if (msg.status === 'FAILED' || msg.status === 'REJECTED') byDay[date].failed++;
    });

    return Object.entries(byDay)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }


  // ============================================
  // Quick SMS Sending
  // ============================================

  /**
   * Send quick SMS to one or more recipients
   */
  async sendQuickSMS(
    associationId: number,
    userId: number,
    data: QuickSMSData
  ): Promise<QuickSMSResult> {
    const { recipients, message, useTemplate, templateId, templateData } = data;

    // R4.6/G53: Integrations Settings' smsProvider ('termii'|'none') was
    // saved but never read — 'none' should actually block sending.
    const smsProvider = await SettingsService.getSetting(associationId, 'integrations', 'smsProvider');
    if (smsProvider === 'none') {
      throw new RuleError('SMS sending is disabled for this association', 403, 'SMS_DISABLED');
    }

    // Get or apply template
    let finalMessage = message;
    if (useTemplate && templateId) {
      const template = await prisma.sMSTemplate.findFirst({
        where: { id: templateId, associationId, isActive: true },
      });
      if (template && templateData) {
        finalMessage = applyMessageTemplate(template.content, templateData);
        // Increment usage count
        await prisma.sMSTemplate.update({
          where: { id: templateId },
          data: { usageCount: { increment: 1 } },
        });
      }
    }

    const segments = assertMessageUsable(finalMessage);

    // Who it goes to: numbers we can text, once each (a member listed twice, or by id and by number, is texted and charged once)
    const resolved = await this.resolveRecipients(associationId, recipients);
    const texts: (Recipient & { phone: string })[] = [];
    for (const r of resolved) {
      const phone = normalizePhone(r.phone);
      if (phone) texts.push({ ...r, phone });
    }
    const unique = dedupeRecipients(texts);
    if (unique.length === 0) {
      throw new RuleError('There is no one to text: none of those have a number we can send to.', 400, 'NO_RECIPIENTS');
    }

    // Credits are reserved before anything goes out; a small send finishes inside the request, a big one carries on in the background.
    const inline = unique.length <= INLINE_LIMIT;
    const dispatch = await dispatchMessages({
      associationId,
      description: 'Quick SMS send',
      recipients: unique,
      text: finalMessage,
      segments,
      messageType: 'SINGLE',
      inline,
    });

    const balance = await prisma.sMSCreditBalance.findUnique({ where: { associationId } });

    if (!inline) {
      return {
        totalSent: 0,
        totalFailed: 0,
        messages: [],
        creditsUsed: dispatch.credits,
        remainingCredits: balance ? Number(balance.balance) : 0,
        accepted: dispatch.accepted,
        inProgress: true,
      };
    }

    const totals = await dispatch.done;
    const rows = await prisma.sMSMessage.findMany({ where: { id: { in: dispatch.messageIds } }, orderBy: { id: 'asc' } });

    return {
      totalSent: totals.sent,
      totalFailed: totals.failed,
      messages: rows.map((row) => ({
        phone: row.recipientPhone,
        success: row.status === 'SENT' || row.status === 'DELIVERED',
        messageId: row.termiiMessageId ?? undefined,
        error: row.errorMessage ?? undefined,
      })),
      // What was actually spent: failed texts have been given back
      creditsUsed: totals.sent * segments,
      remainingCredits: balance ? Number(balance.balance) : 0,
      accepted: dispatch.accepted,
    };
  }
  private async resolveRecipients(
    associationId: number,
    recipients: string[]
  ): Promise<Array<{ phone: string; name?: string; memberId?: number }>> {
    const resolved: Array<{ phone: string; name?: string; memberId?: number }> = [];

    for (const recipient of recipients) {
      // Check if it's a member ID (numeric)
      if (/^\d+$/.test(recipient) && recipient.length < 10) {
        const member = await prisma.member.findFirst({
          where: { 
            associationId, 
            id: parseInt(recipient, 10),
            phone: { not: null },
          },
        });
        if (member && member.phone) {
          resolved.push({
            phone: member.phone,
            name: `${member.firstName} ${member.lastName}`,
            memberId: member.id,
          });
        }
      } else if (isValidPhoneNumber(recipient)) {
        // It's a phone number - try to find matching member
        const formattedPhone = formatPhoneNumber(recipient);
        const member = await prisma.member.findFirst({
          where: { 
            associationId,
            phone: { contains: formattedPhone.slice(-10) },
          },
        });
        resolved.push({
          phone: recipient,
          name: member ? `${member.firstName} ${member.lastName}` : undefined,
          memberId: member?.id,
        });
      }
    }

    return resolved;
  }


  // ============================================
  // Campaign Management
  // ============================================

  /**
   * Create a new SMS campaign
   */
  async createCampaign(
    associationId: number,
    userId: number,
    data: CreateCampaignData
  ) {
    assertMessageUsable(data.message);

    // How many people it would text, worked out the same way as when it is sent
    const audience = await resolveSmsAudience(prisma, associationId, data.recipientType, data.recipientFilter);

    const campaign = await prisma.sMSCampaign.create({
      data: {
        associationId,
        name: data.name,
        message: data.message,
        templateId: data.templateId,
        recipientType: data.recipientType,
        recipientFilter: data.recipientFilter as Prisma.JsonObject || Prisma.JsonNull,
        totalRecipients: audience.willText.length,
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: data.scheduledAt,
        createdBy: userId,
      },
    });

    return campaign;
  }
  async getCampaign(associationId: number, campaignId: number) {
    return prisma.sMSCampaign.findFirst({
      where: { id: campaignId, associationId },
      include: {
        template: true,
        _count: {
          select: { messages: true },
        },
      },
    });
  }

  /**
   * List campaigns with pagination
   */
  async listCampaigns(
    associationId: number,
    options: { page: number; limit: number; status?: SMSCampaignStatus }
  ) {
    const { page, limit, status } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.SMSCampaignWhereInput = { associationId };
    if (status) where.status = status;

    const [campaigns, total] = await Promise.all([
      prisma.sMSCampaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          template: { select: { name: true } },
        },
      }),
      prisma.sMSCampaign.count({ where }),
    ]);

    return {
      campaigns,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Start/execute a campaign
   */
  async startCampaign(associationId: number, campaignId: number): Promise<CampaignStats> {
    const campaign = await prisma.sMSCampaign.findFirst({
      where: { id: campaignId, associationId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    assertCampaignStartable(campaign.status);

    const smsProvider = await SettingsService.getSetting(associationId, 'integrations', 'smsProvider');
    if (smsProvider === 'none') {
      throw new RuleError('SMS sending is disabled for this association', 403, 'SMS_DISABLED');
    }

    // Who gets it: members with a number who haven't opted out, once each
    const audience = await resolveSmsAudience(prisma, associationId, campaign.recipientType, campaign.recipientFilter as RecipientFilter | null);
    if (audience.willText.length === 0) {
      throw new RuleError('No one in this audience can be texted: they have no usable phone number, or have opted out.', 409, 'NO_RECIPIENTS');
    }

    const segments = assertMessageUsable(campaign.message);

    // Claim the campaign: of two taps, or two officers, only one gets to send it
    const previous = campaign.status;
    const { count } = await prisma.sMSCampaign.updateMany({
      where: { id: campaignId, associationId, status: { in: ['DRAFT', 'SCHEDULED'] } },
      data: { status: 'IN_PROGRESS', startedAt: new Date(), totalRecipients: audience.willText.length, sentCount: 0, failedCount: 0 },
    });
    if (count !== 1) {
      throw new RuleError('This campaign is already being sent.', 409, 'ALREADY_STARTED');
    }

    try {
      const dispatch = await dispatchMessages({
        associationId,
        description: `Campaign: ${campaign.name}`,
        recipients: audience.willText,
        text: campaign.message,
        segments,
        messageType: 'BULK',
        campaignId,
      });

      return {
        totalRecipients: dispatch.accepted,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        pendingCount: dispatch.accepted,
        deliveryRate: 0,
        failureRate: 0,
        inProgress: true,
        skipped: { noPhone: audience.noPhone.length, optedOut: audience.optedOut.length },
      };
    } catch (error) {
      // Not enough credits (or the like): nothing went out, so the campaign goes back to how it was and can be started once fixed
      await prisma.sMSCampaign.updateMany({ where: { id: campaignId, status: 'IN_PROGRESS' }, data: { status: previous, startedAt: null } });
      throw error;
    }
  }
  async cancelCampaign(associationId: number, campaignId: number) {
    const { count } = await prisma.sMSCampaign.updateMany({
      where: { id: campaignId, associationId, status: { in: [...CAMPAIGN_CANCELLABLE] } },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });

    if (count !== 1) {
      const campaign = await prisma.sMSCampaign.findFirst({ where: { id: campaignId, associationId }, select: { status: true } });
      if (!campaign) throw new Error('Campaign not found');
      throw new RuleError(`Cannot cancel a campaign that is ${campaign.status.toLowerCase().replace('_', ' ')}.`, 409, 'NOT_CANCELLABLE');
    }

    // A send already under way stops at its next batch, and the credits for what was not sent go back
    return prisma.sMSCampaign.findFirstOrThrow({ where: { id: campaignId } });
  }
  async deleteCampaign(associationId: number, campaignId: number) {
    const campaign = await prisma.sMSCampaign.findFirst({
      where: { id: campaignId, associationId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const { count } = await prisma.sMSCampaign.deleteMany({ where: { id: campaignId, associationId, status: 'DRAFT' } });
    if (count !== 1) {
      throw new RuleError('Only draft campaigns can be deleted.', 409, 'NOT_DELETABLE');
    }
    return campaign;
  }
  /**
   * What sending to an audience would do, before it is sent: who gets a text, who is missed and why, and what it would cost against the
   * balance. Worked out by the same code that sends.
   */
  async previewAudience(associationId: number, recipientType: SMSRecipientType, filter: RecipientFilter | null | undefined, message?: string) {
    const audience = await resolveSmsAudience(prisma, associationId, recipientType, filter);
    const balance = await this.getCreditBalance(associationId);
    const segments = message && message.trim() ? assertMessageUsable(message) : null;
    const credits = segments === null ? null : audience.willText.length * segments;
    return {
      members: audience.members.length,
      willText: audience.willText.length,
      noPhone: audience.noPhone.length,
      optedOut: audience.optedOut.length,
      invalidNumbers: audience.invalidNumbers,
      segments,
      credits,
      balance: balance.balance,
      enough: credits === null ? null : balance.balance + 0.0001 >= credits,
      shortBy: credits === null ? null : Math.max(0, Math.ceil(credits - balance.balance)),
    };
  }

  async getRecipientCount(
    associationId: number,
    recipientType: SMSRecipientType,
    filter?: RecipientFilter | null
  ): Promise<number> {
    return (await resolveSmsAudience(prisma, associationId, recipientType, filter)).willText.length;
  }
  async getCampaignRecipients(
    associationId: number,
    recipientType: SMSRecipientType,
    filter: RecipientFilter | null
  ): Promise<Array<{ phone: string; name?: string; memberId?: number }>> {
    return (await resolveSmsAudience(prisma, associationId, recipientType, filter)).willText;
  }
  // ============================================
  // Credit Management
  // ============================================

  /**
   * Get or create credit balance for association
   */
  private async getOrCreateCreditBalance(associationId: number) {
    let balance = await prisma.sMSCreditBalance.findUnique({
      where: { associationId },
    });

    if (!balance) {
      balance = await prisma.sMSCreditBalance.create({
        data: {
          associationId,
          balance: 0,
          totalPurchased: 0,
          totalUsed: 0,
        },
      });
    }

    return balance;
  }

  /**
   * Deduct credits from balance
   */
  async deductCredits(
    associationId: number,
    amount: number,
    description: string,
    campaignId?: number
  ) {
    // Atomic and never below zero: used by anything that has to spend credits outside a send
    await prisma.$transaction((tx) => reserveCredits(tx, associationId, amount, description, { campaignId }));
  }
  async getCreditBalance(associationId: number) {
    const balance = await this.getOrCreateCreditBalance(associationId);
    return {
      balance: Number(balance.balance),
      totalPurchased: Number(balance.totalPurchased),
      totalUsed: Number(balance.totalUsed),
      lastTopUpAt: balance.lastTopUpAt,
    };
  }

  /**
   * Top up credits
   */
  async topUpCredits(
    associationId: number,
    amount: number,
    reference?: string,
    description?: string
  ) {
    return prisma.$transaction(async (tx) => {
      // The same reference is never credited twice
      if (reference) {
        const existing = await tx.sMSCreditTransaction.findFirst({ where: { type: 'PURCHASE', reference, balance: { associationId } }, select: { id: true } });
        if (existing) {
          const current = await tx.sMSCreditBalance.findUnique({ where: { associationId } });
          return {
            balance: Number(current?.balance ?? 0),
            totalPurchased: Number(current?.totalPurchased ?? 0),
            totalUsed: Number(current?.totalUsed ?? 0),
            lastTopUpAt: current?.lastTopUpAt ?? null,
          };
        }
      }

      // The row it returns already includes the credits just added (the old code added them again to what it reported)
      const balance = await tx.sMSCreditBalance.upsert({
        where: { associationId },
        create: { associationId, balance: amount, totalPurchased: amount, totalUsed: 0, lastTopUpAt: new Date() },
        update: { balance: { increment: amount }, totalPurchased: { increment: amount }, lastTopUpAt: new Date() },
      });

      await tx.sMSCreditTransaction.create({
        data: { balanceId: balance.id, type: 'PURCHASE', amount, description: description || 'Credit top-up', reference },
      });

      return {
        balance: Number(balance.balance),
        totalPurchased: Number(balance.totalPurchased),
        totalUsed: Number(balance.totalUsed),
        lastTopUpAt: balance.lastTopUpAt,
      };
    });
  }

  async getCreditHistory(
    associationId: number,
    options: { page: number; limit: number }
  ) {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    // First get the balance to get balanceId
    const balance = await this.getOrCreateCreditBalance(associationId);

    const [transactions, total] = await Promise.all([
      prisma.sMSCreditTransaction.findMany({
        where: { balanceId: balance.id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sMSCreditTransaction.count({ where: { balanceId: balance.id } }),
    ]);

    return {
      transactions: transactions.map(t => ({
        ...t,
        amount: Number(t.amount),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ============================================
  // Template Management
  // ============================================

  /**
   * Create SMS template
   */
  async createTemplate(
    associationId: number,
    userId: number,
    data: CreateTemplateData
  ) {
    return prisma.sMSTemplate.create({
      data: {
        associationId,
        name: data.name,
        content: data.content,
        category: data.category,
        placeholders: data.placeholders || [],
        createdBy: userId,
      },
    });
  }

  /**
   * Update SMS template
   */
  async updateTemplate(
    associationId: number,
    templateId: number,
    data: UpdateTemplateData
  ) {
    const template = await prisma.sMSTemplate.findFirst({
      where: { id: templateId, associationId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    return prisma.sMSTemplate.update({
      where: { id: templateId },
      data: {
        name: data.name,
        content: data.content,
        category: data.category,
        placeholders: data.placeholders,
        isActive: data.isActive,
      },
    });
  }

  /**
   * Delete SMS template
   */
  async deleteTemplate(associationId: number, templateId: number) {
    const template = await prisma.sMSTemplate.findFirst({
      where: { id: templateId, associationId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    return prisma.sMSTemplate.delete({
      where: { id: templateId },
    });
  }

  /**
   * Get SMS template by ID
   */
  async getTemplate(associationId: number, templateId: number) {
    return prisma.sMSTemplate.findFirst({
      where: { id: templateId, associationId },
    });
  }

  /**
   * List SMS templates
   */
  async listTemplates(
    associationId: number,
    options: { page: number; limit: number; category?: SMSTemplateCategory; isActive?: boolean }
  ) {
    const { page, limit, category, isActive } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.SMSTemplateWhereInput = { associationId };
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive;

    const [templates, total] = await Promise.all([
      prisma.sMSTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sMSTemplate.count({ where }),
    ]);

    return {
      templates,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ============================================
  // Message Management
  // ============================================

  /**
   * List SMS messages
   */
  async listMessages(
    associationId: number,
    options: {
      page: number;
      limit: number;
      status?: SMSStatus;
      campaignId?: number;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const { page, limit, status, campaignId, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.SMSMessageWhereInput = { associationId };
    if (status) where.status = status;
    if (campaignId) where.campaignId = campaignId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [messages, total] = await Promise.all([
      prisma.sMSMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          campaign: { select: { name: true } },
        },
      }),
      prisma.sMSMessage.count({ where }),
    ]);

    return {
      messages: messages.map(m => ({
        ...m,
        cost: m.cost ? Number(m.cost) : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get SMS message by ID
   */
  async getMessage(associationId: number, messageId: number) {
    const message = await prisma.sMSMessage.findFirst({
      where: { id: messageId, associationId },
      include: {
        campaign: { select: { name: true } },
      },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    // Get member info if memberId exists
    let memberInfo = null;
    if (message.memberId) {
      const member = await prisma.member.findUnique({
        where: { id: message.memberId },
        select: { firstName: true, lastName: true },
      });
      memberInfo = member;
    }

    return {
      ...message,
      cost: message.cost ? Number(message.cost) : null,
      member: memberInfo,
    };
  }
}