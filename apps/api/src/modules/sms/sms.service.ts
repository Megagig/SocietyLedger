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

    // Calculate segments
    const segments = calculateSMSSegments(finalMessage);

    // Resolve recipients (could be phone numbers or member IDs)
    const resolvedRecipients = await this.resolveRecipients(associationId, recipients);

    // Check credit balance
    const creditBalance = await this.getOrCreateCreditBalance(associationId);
    const requiredCredits = resolvedRecipients.length * segments;
    
    if (Number(creditBalance.balance) < requiredCredits) {
      throw new Error(`Insufficient SMS credits. Required: ${requiredCredits}, Available: ${creditBalance.balance}`);
    }

    // Send SMS to each recipient
    const results: QuickSMSResult['messages'] = [];
    let totalSent = 0;
    let totalFailed = 0;

    for (const recipient of resolvedRecipients) {
      const smsResult = await sendSMS({
        to: recipient.phone,
        message: finalMessage,
      });

      // Create message record
      await prisma.sMSMessage.create({
        data: {
          associationId,
          recipientPhone: formatPhoneNumber(recipient.phone),
          recipientName: recipient.name,
          memberId: recipient.memberId,
          message: finalMessage,
          messageType: 'SINGLE',
          status: smsResult.success ? 'SENT' : 'FAILED',
          termiiMessageId: smsResult.messageId,
          segments,
          errorMessage: smsResult.error,
          sentAt: smsResult.success ? new Date() : null,
        },
      });

      results.push({
        phone: formatPhoneNumber(recipient.phone),
        success: smsResult.success,
        messageId: smsResult.messageId,
        error: smsResult.error,
      });

      if (smsResult.success) {
        totalSent++;
      } else {
        totalFailed++;
      }
    }

    // Deduct credits for sent messages
    const creditsUsed = totalSent * segments;
    if (creditsUsed > 0) {
      await this.deductCredits(associationId, creditsUsed, 'Quick SMS send');
    }

    // Get updated balance
    const updatedBalance = await prisma.sMSCreditBalance.findUnique({
      where: { associationId },
    });

    return {
      totalSent,
      totalFailed,
      messages: results,
      creditsUsed,
      remainingCredits: updatedBalance ? Number(updatedBalance.balance) : 0,
    };
  }

  /**
   * Resolve recipients from phone numbers or member IDs
   */
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
    // Get recipient count based on filter
    const recipientCount = await this.getRecipientCount(associationId, data.recipientType, data.recipientFilter);

    const campaign = await prisma.sMSCampaign.create({
      data: {
        associationId,
        name: data.name,
        message: data.message,
        templateId: data.templateId,
        recipientType: data.recipientType,
        recipientFilter: data.recipientFilter as Prisma.JsonObject || Prisma.JsonNull,
        totalRecipients: recipientCount,
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: data.scheduledAt,
        createdBy: userId,
      },
    });

    return campaign;
  }

  /**
   * Get campaign by ID
   */
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

    if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
      throw new Error(`Cannot start campaign with status: ${campaign.status}`);
    }

    // Get recipients
    const recipients = await this.getCampaignRecipients(
      associationId,
      campaign.recipientType,
      campaign.recipientFilter as RecipientFilter | null
    );

    if (recipients.length === 0) {
      throw new Error('No recipients found for this campaign');
    }

    // Check credits
    const segments = calculateSMSSegments(campaign.message);
    const requiredCredits = recipients.length * segments;
    const creditBalance = await this.getOrCreateCreditBalance(associationId);

    if (Number(creditBalance.balance) < requiredCredits) {
      throw new Error(`Insufficient credits. Required: ${requiredCredits}, Available: ${creditBalance.balance}`);
    }

    // Update campaign status
    await prisma.sMSCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        totalRecipients: recipients.length,
      },
    });

    // Send messages
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      const result = await sendSMS({
        to: recipient.phone,
        message: campaign.message,
      });

      await prisma.sMSMessage.create({
        data: {
          associationId,
          campaignId,
          recipientPhone: formatPhoneNumber(recipient.phone),
          recipientName: recipient.name,
          memberId: recipient.memberId,
          message: campaign.message,
          messageType: 'BULK',
          status: result.success ? 'SENT' : 'FAILED',
          termiiMessageId: result.messageId,
          segments,
          errorMessage: result.error,
          sentAt: result.success ? new Date() : null,
        },
      });

      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
      }
    }

    // Deduct credits
    const creditsUsed = sentCount * segments;
    if (creditsUsed > 0) {
      await this.deductCredits(associationId, creditsUsed, `Campaign: ${campaign.name}`, campaignId);
    }

    // Update campaign with final stats
    await prisma.sMSCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        sentCount,
        failedCount,
      },
    });

    return {
      totalRecipients: recipients.length,
      sentCount,
      deliveredCount: sentCount, // Will be updated by delivery reports
      failedCount,
      pendingCount: 0,
      deliveryRate: recipients.length > 0 ? (sentCount / recipients.length) * 100 : 0,
      failureRate: recipients.length > 0 ? (failedCount / recipients.length) * 100 : 0,
    };
  }

  /**
   * Cancel a campaign
   */
  async cancelCampaign(associationId: number, campaignId: number) {
    const campaign = await prisma.sMSCampaign.findFirst({
      where: { id: campaignId, associationId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED') {
      throw new Error(`Cannot cancel campaign with status: ${campaign.status}`);
    }

    return prisma.sMSCampaign.update({
      where: { id: campaignId },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Delete a draft campaign
   */
  async deleteCampaign(associationId: number, campaignId: number) {
    const campaign = await prisma.sMSCampaign.findFirst({
      where: { id: campaignId, associationId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'DRAFT') {
      throw new Error('Only draft campaigns can be deleted');
    }

    return prisma.sMSCampaign.delete({
      where: { id: campaignId },
    });
  }

  /**
   * Get recipient count based on filter
   */
  private async getRecipientCount(
    associationId: number,
    recipientType: SMSRecipientType,
    filter?: RecipientFilter | null
  ): Promise<number> {
    switch (recipientType) {
      case 'ALL_MEMBERS':
        return prisma.member.count({
          where: { associationId, phone: { not: null }, status: 'ACTIVE' },
        });

      case 'SELECTED_MEMBERS':
        if (!filter?.memberIds?.length) return 0;
        return prisma.member.count({
          where: { 
            associationId, 
            id: { in: filter.memberIds },
            phone: { not: null },
          },
        });

      case 'MEMBER_CATEGORY':
        if (!filter?.categories?.length) return 0;
        return prisma.member.count({
          where: { 
            associationId, 
            category: { in: filter.categories },
            phone: { not: null },
            status: 'ACTIVE',
          },
        });

      case 'CUSTOM_NUMBERS':
        return filter?.customNumbers?.length || 0;

      case 'OWING_MEMBERS':
        // Members with outstanding balance
        const owingMembers = await prisma.member.findMany({
          where: { 
            associationId, 
            phone: { not: null },
            status: 'ACTIVE',
          },
          include: {
            transactions: {
              where: { status: 'PENDING' },
              select: { amount: true },
            },
          },
        });
        const minAmount = filter?.owingMinAmount || 0;
        return owingMembers.filter(m => {
          const totalOwing = m.transactions.reduce((sum, t) => sum + Number(t.amount), 0);
          return totalOwing >= minAmount;
        }).length;

      case 'PAID_MEMBERS':
        // Members with no outstanding balance
        const paidMembers = await prisma.member.findMany({
          where: { 
            associationId, 
            phone: { not: null },
            status: 'ACTIVE',
          },
          include: {
            transactions: {
              where: { status: 'PENDING' },
              select: { amount: true },
            },
          },
        });
        return paidMembers.filter(m => {
          const totalOwing = m.transactions.reduce((sum, t) => sum + Number(t.amount), 0);
          return totalOwing === 0;
        }).length;

      default:
        return 0;
    }
  }

  /**
   * Get campaign recipients based on filter
   */
  private async getCampaignRecipients(
    associationId: number,
    recipientType: SMSRecipientType,
    filter: RecipientFilter | null
  ): Promise<Array<{ phone: string; name?: string; memberId?: number }>> {
    const recipients: Array<{ phone: string; name?: string; memberId?: number }> = [];

    switch (recipientType) {
      case 'ALL_MEMBERS': {
        const members = await prisma.member.findMany({
          where: { associationId, phone: { not: null }, status: 'ACTIVE' },
          select: { id: true, firstName: true, lastName: true, phone: true },
        });
        members.forEach(m => {
          if (m.phone) {
            recipients.push({
              phone: m.phone,
              name: `${m.firstName} ${m.lastName}`,
              memberId: m.id,
            });
          }
        });
        break;
      }

      case 'SELECTED_MEMBERS': {
        if (!filter?.memberIds?.length) break;
        const members = await prisma.member.findMany({
          where: { 
            associationId, 
            id: { in: filter.memberIds },
            phone: { not: null },
          },
          select: { id: true, firstName: true, lastName: true, phone: true },
        });
        members.forEach(m => {
          if (m.phone) {
            recipients.push({
              phone: m.phone,
              name: `${m.firstName} ${m.lastName}`,
              memberId: m.id,
            });
          }
        });
        break;
      }

      case 'MEMBER_CATEGORY': {
        if (!filter?.categories?.length) break;
        const members = await prisma.member.findMany({
          where: { 
            associationId, 
            category: { in: filter.categories },
            phone: { not: null },
            status: 'ACTIVE',
          },
          select: { id: true, firstName: true, lastName: true, phone: true },
        });
        members.forEach(m => {
          if (m.phone) {
            recipients.push({
              phone: m.phone,
              name: `${m.firstName} ${m.lastName}`,
              memberId: m.id,
            });
          }
        });
        break;
      }

      case 'CUSTOM_NUMBERS': {
        if (!filter?.customNumbers?.length) break;
        filter.customNumbers.forEach(phone => {
          recipients.push({ phone });
        });
        break;
      }

      case 'OWING_MEMBERS': {
        const members = await prisma.member.findMany({
          where: { 
            associationId, 
            phone: { not: null },
            status: 'ACTIVE',
          },
          include: {
            transactions: {
              where: { status: 'PENDING' },
              select: { amount: true },
            },
          },
        });
        const minAmount = filter?.owingMinAmount || 0;
        members.forEach(m => {
          const totalOwing = m.transactions.reduce((sum, t) => sum + Number(t.amount), 0);
          if (totalOwing >= minAmount && m.phone) {
            recipients.push({
              phone: m.phone,
              name: `${m.firstName} ${m.lastName}`,
              memberId: m.id,
            });
          }
        });
        break;
      }

      case 'PAID_MEMBERS': {
        const members = await prisma.member.findMany({
          where: { 
            associationId, 
            phone: { not: null },
            status: 'ACTIVE',
          },
          include: {
            transactions: {
              where: { status: 'PENDING' },
              select: { amount: true },
            },
          },
        });
        members.forEach(m => {
          const totalOwing = m.transactions.reduce((sum, t) => sum + Number(t.amount), 0);
          if (totalOwing === 0 && m.phone) {
            recipients.push({
              phone: m.phone,
              name: `${m.firstName} ${m.lastName}`,
              memberId: m.id,
            });
          }
        });
        break;
      }
    }

    return recipients;
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
  private async deductCredits(
    associationId: number,
    amount: number,
    description: string,
    campaignId?: number
  ) {
    const balance = await this.getOrCreateCreditBalance(associationId);
    
    await prisma.$transaction([
      prisma.sMSCreditBalance.update({
        where: { associationId },
        data: {
          balance: { decrement: amount },
          totalUsed: { increment: amount },
        },
      }),
      prisma.sMSCreditTransaction.create({
        data: {
          balanceId: balance.id,
          type: 'USAGE',
          amount: -amount,
          description,
          campaignId,
        },
      }),
    ]);
  }

  /**
   * Get credit balance
   */
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
    const balance = await prisma.sMSCreditBalance.upsert({
      where: { associationId },
      create: {
        associationId,
        balance: amount,
        totalPurchased: amount,
        totalUsed: 0,
        lastTopUpAt: new Date(),
      },
      update: {
        balance: { increment: amount },
        totalPurchased: { increment: amount },
        lastTopUpAt: new Date(),
      },
    });

    await prisma.sMSCreditTransaction.create({
      data: {
        balanceId: balance.id,
        type: 'PURCHASE',
        amount,
        description: description || 'Credit top-up',
        reference,
      },
    });

    return {
      balance: Number(balance.balance) + amount, // Add amount since upsert returns before increment
      totalPurchased: Number(balance.totalPurchased) + amount,
      totalUsed: Number(balance.totalUsed),
      lastTopUpAt: new Date(),
    };
  }

  /**
   * Get credit transaction history
   */
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