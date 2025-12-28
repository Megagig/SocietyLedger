// ============================================
// PHASE 5.5: WELFARE & SOCIAL FUNDS SERVICE
// ============================================

import { prisma } from '../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import {
  CreateWelfareFundInput,
  UpdateWelfareFundInput,
  RecordContributionInput,
  BulkContributionInput,
  CreatePayoutRequestInput,
  ReviewPayoutInput,
  DisbursePayoutInput,
} from './welfare.validation';

export const welfareService = {
  // ==========================================
  // WELFARE FUND MANAGEMENT
  // ==========================================

  async createFund(associationId: number, userId: number, data: CreateWelfareFundInput) {
    // Check for duplicate fund name
    const existing = await prisma.welfareFund.findFirst({
      where: {
        associationId,
        name: { equals: data.name, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new Error('A welfare fund with this name already exists');
    }

    const fund = await prisma.welfareFund.create({
      data: {
        associationId,
        name: data.name,
        description: data.description,
        fundType: data.fundType,
        targetBalance: data.targetBalance,
        monthlyContribution: data.monthlyContribution,
        isContributionMandatory: data.isContributionMandatory ?? false,
        minContribution: data.minContribution,
        maxPayout: data.maxPayout,
        waitingPeriodDays: data.waitingPeriodDays ?? 0,
        minContributionMonths: data.minContributionMonths ?? 0,
        createdBy: userId,
      },
    });

    return fund;
  },

  async updateFund(associationId: number, fundId: number, data: UpdateWelfareFundInput) {
    const fund = await prisma.welfareFund.findFirst({
      where: { id: fundId, associationId },
    });

    if (!fund) {
      throw new Error('Welfare fund not found');
    }

    // Check name uniqueness if changing
    if (data.name && data.name !== fund.name) {
      const duplicate = await prisma.welfareFund.findFirst({
        where: {
          associationId,
          name: { equals: data.name, mode: 'insensitive' },
          id: { not: fundId },
        },
      });

      if (duplicate) {
        throw new Error('A welfare fund with this name already exists');
      }
    }

    return prisma.welfareFund.update({
      where: { id: fundId },
      data: {
        name: data.name,
        description: data.description,
        fundType: data.fundType,
        targetBalance: data.targetBalance,
        monthlyContribution: data.monthlyContribution,
        isContributionMandatory: data.isContributionMandatory,
        minContribution: data.minContribution,
        maxPayout: data.maxPayout,
        waitingPeriodDays: data.waitingPeriodDays,
        minContributionMonths: data.minContributionMonths,
        status: data.status,
      },
    });
  },

  async getFund(associationId: number, fundId: number) {
    const fund = await prisma.welfareFund.findFirst({
      where: { id: fundId, associationId },
      include: {
        _count: {
          select: {
            contributions: true,
            payoutRequests: true,
          },
        },
      },
    });

    if (!fund) {
      throw new Error('Welfare fund not found');
    }

    // Get additional stats
    const [totalContributions, totalPayouts, contributorCount] = await Promise.all([
      prisma.welfareContribution.aggregate({
        where: { fundId, associationId, status: 'CONFIRMED' },
        _sum: { amount: true },
      }),
      prisma.welfarePayoutRequest.aggregate({
        where: { fundId, associationId, status: 'DISBURSED' },
        _sum: { approvedAmount: true },
      }),
      prisma.welfareContribution.groupBy({
        by: ['memberId'],
        where: { fundId, associationId, status: 'CONFIRMED' },
      }),
    ]);

    return {
      ...fund,
      stats: {
        totalContributions: totalContributions._sum.amount || new Decimal(0),
        totalPayouts: totalPayouts._sum.approvedAmount || new Decimal(0),
        contributorCount: contributorCount.length,
      },
    };
  },

  async listFunds(
    associationId: number,
    params: {
      page: number;
      limit: number;
      fundType?: string;
      status?: string;
      search?: string;
    }
  ) {
    const { page, limit, fundType, status, search } = params;
    const skip = (page - 1) * limit;

    const where: any = { associationId };

    if (fundType) {
      where.fundType = fundType;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [funds, totalCount] = await Promise.all([
      prisma.welfareFund.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              contributions: true,
              payoutRequests: true,
            },
          },
        },
      }),
      prisma.welfareFund.count({ where }),
    ]);

    return {
      funds,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + funds.length < totalCount,
      },
    };
  },

  async deleteFund(associationId: number, fundId: number) {
    const fund = await prisma.welfareFund.findFirst({
      where: { id: fundId, associationId },
      include: {
        _count: {
          select: {
            contributions: { where: { status: 'CONFIRMED' } },
            payoutRequests: { where: { status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] } } },
          },
        },
      },
    });

    if (!fund) {
      throw new Error('Welfare fund not found');
    }

    if (fund._count.contributions > 0) {
      throw new Error('Cannot delete fund with confirmed contributions. Consider closing it instead.');
    }

    if (fund._count.payoutRequests > 0) {
      throw new Error('Cannot delete fund with pending payout requests');
    }

    await prisma.welfareFund.delete({ where: { id: fundId } });
    return { success: true };
  },

  // ==========================================
  // CONTRIBUTION MANAGEMENT
  // ==========================================

  async recordContribution(associationId: number, userId: number, data: RecordContributionInput) {
    // Verify fund exists and is active
    const fund = await prisma.welfareFund.findFirst({
      where: { id: data.fundId, associationId, status: 'ACTIVE' },
    });

    if (!fund) {
      throw new Error('Welfare fund not found or not active');
    }

    // Verify member exists
    const member = await prisma.member.findFirst({
      where: { id: data.memberId, associationId },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    // Check minimum contribution
    if (fund.minContribution && data.amount < Number(fund.minContribution)) {
      throw new Error(`Minimum contribution is ${fund.minContribution}`);
    }

    const contribution = await prisma.welfareContribution.create({
      data: {
        associationId,
        fundId: data.fundId,
        memberId: data.memberId,
        amount: data.amount,
        contributionDate: data.contributionDate ? new Date(data.contributionDate) : new Date(),
        paymentMethod: data.paymentMethod,
        reference: data.reference,
        notes: data.notes,
        status: 'PENDING',
      },
      include: {
        fund: { select: { id: true, name: true, fundType: true } },
        member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
      },
    });

    return contribution;
  },

  async bulkRecordContributions(associationId: number, userId: number, data: BulkContributionInput) {
    // Verify fund exists and is active
    const fund = await prisma.welfareFund.findFirst({
      where: { id: data.fundId, associationId, status: 'ACTIVE' },
    });

    if (!fund) {
      throw new Error('Welfare fund not found or not active');
    }

    // Verify all members exist
    const members = await prisma.member.findMany({
      where: { id: { in: data.memberIds }, associationId },
    });

    if (members.length !== data.memberIds.length) {
      throw new Error('Some members not found');
    }

    // Check minimum contribution
    if (fund.minContribution && data.amount < Number(fund.minContribution)) {
      throw new Error(`Minimum contribution is ${fund.minContribution}`);
    }

    const contributionDate = data.contributionDate ? new Date(data.contributionDate) : new Date();

    const contributions = await prisma.$transaction(
      data.memberIds.map((memberId) =>
        prisma.welfareContribution.create({
          data: {
            associationId,
            fundId: data.fundId,
            memberId,
            amount: data.amount,
            contributionDate,
            paymentMethod: data.paymentMethod,
            notes: data.notes,
            status: 'PENDING',
          },
        })
      )
    );

    return { count: contributions.length, contributions };
  },

  async confirmContribution(
    associationId: number,
    contributionId: number,
    userId: number,
    status: 'CONFIRMED' | 'REJECTED',
    notes?: string
  ) {
    const contribution = await prisma.welfareContribution.findFirst({
      where: { id: contributionId, associationId, status: 'PENDING' },
      include: { fund: true },
    });

    if (!contribution) {
      throw new Error('Contribution not found or already processed');
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update contribution status
      const updatedContribution = await tx.welfareContribution.update({
        where: { id: contributionId },
        data: {
          status,
          confirmedBy: userId,
          confirmedAt: new Date(),
          notes: notes || contribution.notes,
        },
        include: {
          fund: { select: { id: true, name: true } },
          member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
        },
      });

      // If confirmed, update fund balance
      if (status === 'CONFIRMED') {
        await tx.welfareFund.update({
          where: { id: contribution.fundId },
          data: {
            currentBalance: { increment: contribution.amount },
          },
        });
      }

      return updatedContribution;
    });

    return updated;
  },

  async listContributions(
    associationId: number,
    params: {
      page: number;
      limit: number;
      fundId?: number;
      memberId?: number;
      status?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const { page, limit, fundId, memberId, status, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: any = { associationId };

    if (fundId) where.fundId = fundId;
    if (memberId) where.memberId = memberId;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.contributionDate = {};
      if (startDate) where.contributionDate.gte = new Date(startDate);
      if (endDate) where.contributionDate.lte = new Date(endDate);
    }

    const [contributions, totalCount] = await Promise.all([
      prisma.welfareContribution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { contributionDate: 'desc' },
        include: {
          fund: { select: { id: true, name: true, fundType: true } },
          member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
          confirmer: { select: { id: true, email: true } },
        },
      }),
      prisma.welfareContribution.count({ where }),
    ]);

    return {
      contributions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + contributions.length < totalCount,
      },
    };
  },

  // ==========================================
  // PAYOUT REQUEST MANAGEMENT
  // ==========================================

  async createPayoutRequest(associationId: number, memberId: number, data: CreatePayoutRequestInput) {
    // Verify fund exists and is active
    const fund = await prisma.welfareFund.findFirst({
      where: { id: data.fundId, associationId, status: 'ACTIVE' },
    });

    if (!fund) {
      throw new Error('Welfare fund not found or not active');
    }

    // Check member eligibility
    const eligibility = await this.checkMemberEligibility(associationId, memberId, data.fundId);
    
    if (!eligibility.isEligible) {
      throw new Error(eligibility.reason || 'Member is not eligible for payout from this fund');
    }

    // Check max payout limit
    if (fund.maxPayout && data.amount > Number(fund.maxPayout)) {
      throw new Error(`Maximum payout amount is ${fund.maxPayout}`);
    }

    // Check fund balance
    if (data.amount > Number(fund.currentBalance)) {
      throw new Error('Insufficient fund balance');
    }

    // Generate request number
    const requestCount = await prisma.welfarePayoutRequest.count({ where: { associationId } });
    const requestNumber = `WPR${String(requestCount + 1).padStart(6, '0')}`;

    const request = await prisma.welfarePayoutRequest.create({
      data: {
        associationId,
        fundId: data.fundId,
        memberId,
        requestNumber,
        payoutType: data.payoutType,
        amount: data.amount,
        reason: data.reason,
        supportingDocuments: data.supportingDocuments,
        status: data.payoutType === 'EMERGENCY' || data.payoutType === 'BEREAVEMENT' 
          ? 'UNDER_REVIEW' 
          : 'PENDING',
      },
      include: {
        fund: { select: { id: true, name: true, fundType: true } },
        member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
      },
    });

    return request;
  },

  async checkMemberEligibility(associationId: number, memberId: number, fundId: number) {
    const fund = await prisma.welfareFund.findFirst({
      where: { id: fundId, associationId },
    });

    if (!fund) {
      return { isEligible: false, reason: 'Fund not found' };
    }

    // Check waiting period
    const member = await prisma.member.findFirst({
      where: { id: memberId, associationId },
    });

    if (!member) {
      return { isEligible: false, reason: 'Member not found' };
    }

    if (fund.waitingPeriodDays > 0 && member.joinDate) {
      const daysSinceJoin = Math.floor(
        (Date.now() - member.joinDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceJoin < fund.waitingPeriodDays) {
        return {
          isEligible: false,
          reason: `Member must wait ${fund.waitingPeriodDays - daysSinceJoin} more days`,
        };
      }
    }

    // Check minimum contribution months
    if (fund.minContributionMonths > 0) {
      const contributionMonths = await prisma.welfareContribution.groupBy({
        by: ['contributionDate'],
        where: {
          fundId,
          memberId,
          associationId,
          status: 'CONFIRMED',
        },
      });

      // Count unique months
      const uniqueMonths = new Set(
        contributionMonths.map((c) => {
          const date = new Date(c.contributionDate);
          return `${date.getFullYear()}-${date.getMonth()}`;
        })
      );

      if (uniqueMonths.size < fund.minContributionMonths) {
        return {
          isEligible: false,
          reason: `Member needs ${fund.minContributionMonths - uniqueMonths.size} more months of contributions`,
        };
      }
    }

    // Check for pending requests
    const pendingRequest = await prisma.welfarePayoutRequest.findFirst({
      where: {
        fundId,
        memberId,
        associationId,
        status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] },
      },
    });

    if (pendingRequest) {
      return { isEligible: false, reason: 'Member has a pending payout request' };
    }

    return { isEligible: true, reason: null };
  },

  async reviewPayoutRequest(
    associationId: number,
    requestId: number,
    userId: number,
    data: ReviewPayoutInput
  ) {
    const request = await prisma.welfarePayoutRequest.findFirst({
      where: {
        id: requestId,
        associationId,
        status: { in: ['PENDING', 'UNDER_REVIEW'] },
      },
      include: { fund: true },
    });

    if (!request) {
      throw new Error('Payout request not found or already processed');
    }

    const updateData: any = {
      reviewedBy: userId,
      reviewedAt: new Date(),
      reviewComments: data.comments,
    };

    if (data.status === 'APPROVED') {
      const approvedAmount = data.approvedAmount || Number(request.amount);
      
      // Check fund balance
      if (approvedAmount > Number(request.fund.currentBalance)) {
        throw new Error('Insufficient fund balance for approval');
      }

      updateData.status = 'APPROVED';
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
      updateData.approvedAmount = approvedAmount;
    } else {
      updateData.status = 'REJECTED';
      updateData.rejectionReason = data.rejectionReason;
    }

    const updated = await prisma.welfarePayoutRequest.update({
      where: { id: requestId },
      data: updateData,
      include: {
        fund: { select: { id: true, name: true } },
        member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
      },
    });

    return updated;
  },

  async disbursePayoutRequest(
    associationId: number,
    requestId: number,
    userId: number,
    data: DisbursePayoutInput
  ) {
    const request = await prisma.welfarePayoutRequest.findFirst({
      where: { id: requestId, associationId, status: 'APPROVED' },
      include: { fund: true },
    });

    if (!request) {
      throw new Error('Payout request not found or not approved');
    }

    if (!request.approvedAmount) {
      throw new Error('No approved amount set');
    }

    // Check fund balance again
    if (Number(request.approvedAmount) > Number(request.fund.currentBalance)) {
      throw new Error('Insufficient fund balance for disbursement');
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update payout request
      const updatedRequest = await tx.welfarePayoutRequest.update({
        where: { id: requestId },
        data: {
          status: 'DISBURSED',
          disbursedBy: userId,
          disbursedAt: new Date(),
          disbursementMethod: data.disbursementMethod,
          disbursementReference: data.disbursementReference,
        },
        include: {
          fund: { select: { id: true, name: true } },
          member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
        },
      });

      // Deduct from fund balance
      await tx.welfareFund.update({
        where: { id: request.fundId },
        data: {
          currentBalance: { decrement: request.approvedAmount! },
        },
      });

      return updatedRequest;
    });

    return updated;
  },

  async cancelPayoutRequest(associationId: number, requestId: number, memberId: number) {
    const request = await prisma.welfarePayoutRequest.findFirst({
      where: {
        id: requestId,
        associationId,
        memberId,
        status: { in: ['PENDING', 'UNDER_REVIEW'] },
      },
    });

    if (!request) {
      throw new Error('Payout request not found or cannot be cancelled');
    }

    return prisma.welfarePayoutRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });
  },

  async listPayoutRequests(
    associationId: number,
    params: {
      page: number;
      limit: number;
      fundId?: number;
      memberId?: number;
      status?: string;
      payoutType?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const { page, limit, fundId, memberId, status, payoutType, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: any = { associationId };

    if (fundId) where.fundId = fundId;
    if (memberId) where.memberId = memberId;
    if (status) where.status = status;
    if (payoutType) where.payoutType = payoutType;

    if (startDate || endDate) {
      where.requestedAt = {};
      if (startDate) where.requestedAt.gte = new Date(startDate);
      if (endDate) where.requestedAt.lte = new Date(endDate);
    }

    const [requests, totalCount] = await Promise.all([
      prisma.welfarePayoutRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { requestedAt: 'desc' },
        include: {
          fund: { select: { id: true, name: true, fundType: true } },
          member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
          reviewer: { select: { id: true, email: true } },
          approver: { select: { id: true, email: true } },
          disburser: { select: { id: true, email: true } },
        },
      }),
      prisma.welfarePayoutRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + requests.length < totalCount,
      },
    };
  },

  // ==========================================
  // DASHBOARD & ANALYTICS
  // ==========================================

  async getDashboard(associationId: number) {
    const [
      fundStats,
      totalContributions,
      totalPayouts,
      pendingPayouts,
      memberCount,
      contributorCount,
    ] = await Promise.all([
      prisma.welfareFund.aggregate({
        where: { associationId },
        _count: { id: true },
        _sum: { currentBalance: true },
      }),
      prisma.welfareContribution.aggregate({
        where: { associationId, status: 'CONFIRMED' },
        _sum: { amount: true },
      }),
      prisma.welfarePayoutRequest.aggregate({
        where: { associationId, status: 'DISBURSED' },
        _sum: { approvedAmount: true },
      }),
      prisma.welfarePayoutRequest.count({
        where: { associationId, status: { in: ['PENDING', 'UNDER_REVIEW'] } },
      }),
      prisma.member.count({ where: { associationId, status: 'active' } }),
      prisma.welfareContribution.groupBy({
        by: ['memberId'],
        where: { associationId, status: 'CONFIRMED' },
      }),
    ]);

    const activeFunds = await prisma.welfareFund.count({
      where: { associationId, status: 'ACTIVE' },
    });

    return {
      totalFunds: fundStats._count.id,
      activeFunds,
      totalBalance: fundStats._sum.currentBalance || new Decimal(0),
      totalContributions: totalContributions._sum.amount || new Decimal(0),
      totalPayouts: totalPayouts._sum.approvedAmount || new Decimal(0),
      pendingPayoutRequests: pendingPayouts,
      memberParticipationRate: memberCount > 0 
        ? Math.round((contributorCount.length / memberCount) * 100) 
        : 0,
    };
  },

  async getMemberWelfareProfile(associationId: number, memberId: number) {
    const member = await prisma.member.findFirst({
      where: { id: memberId, associationId },
      select: { id: true, memberId: true, firstName: true, lastName: true },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    const [contributions, payouts, pendingRequests] = await Promise.all([
      prisma.welfareContribution.aggregate({
        where: { memberId, associationId, status: 'CONFIRMED' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.welfarePayoutRequest.aggregate({
        where: { memberId, associationId, status: 'DISBURSED' },
        _sum: { approvedAmount: true },
        _count: { id: true },
      }),
      prisma.welfarePayoutRequest.count({
        where: { memberId, associationId, status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] } },
      }),
    ]);

    const lastContribution = await prisma.welfareContribution.findFirst({
      where: { memberId, associationId, status: 'CONFIRMED' },
      orderBy: { contributionDate: 'desc' },
      select: { contributionDate: true },
    });

    // Get eligible funds
    const activeFunds = await prisma.welfareFund.findMany({
      where: { associationId, status: 'ACTIVE' },
      select: { id: true },
    });

    const eligibleFundIds: number[] = [];
    for (const fund of activeFunds) {
      const eligibility = await this.checkMemberEligibility(associationId, memberId, fund.id);
      if (eligibility.isEligible) {
        eligibleFundIds.push(fund.id);
      }
    }

    return {
      memberId: member.id,
      memberName: `${member.firstName} ${member.lastName}`,
      totalContributions: contributions._sum.amount || new Decimal(0),
      contributionCount: contributions._count.id,
      lastContributionDate: lastContribution?.contributionDate,
      totalPayoutsReceived: payouts._sum.approvedAmount || new Decimal(0),
      payoutCount: payouts._count.id,
      eligibleFunds: eligibleFundIds,
      pendingRequests,
    };
  },

  async getFundSummaries(associationId: number) {
    const funds = await prisma.welfareFund.findMany({
      where: { associationId },
      select: {
        id: true,
        name: true,
        fundType: true,
        currentBalance: true,
      },
    });

    const summaries = await Promise.all(
      funds.map(async (fund) => {
        const [contributions, payouts, contributors, pendingPayouts] = await Promise.all([
          prisma.welfareContribution.aggregate({
            where: { fundId: fund.id, status: 'CONFIRMED' },
            _sum: { amount: true },
          }),
          prisma.welfarePayoutRequest.aggregate({
            where: { fundId: fund.id, status: 'DISBURSED' },
            _sum: { approvedAmount: true },
          }),
          prisma.welfareContribution.groupBy({
            by: ['memberId'],
            where: { fundId: fund.id, status: 'CONFIRMED' },
          }),
          prisma.welfarePayoutRequest.count({
            where: { fundId: fund.id, status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] } },
          }),
        ]);

        return {
          fundId: fund.id,
          fundName: fund.name,
          fundType: fund.fundType,
          currentBalance: fund.currentBalance,
          totalContributions: contributions._sum.amount || new Decimal(0),
          totalPayouts: payouts._sum.approvedAmount || new Decimal(0),
          contributorCount: contributors.length,
          pendingPayouts,
        };
      })
    );

    return summaries;
  },

  // ==========================================
  // BEREAVEMENT SUPPORT (TASK-WELF-006)
  // ==========================================

  async createBereavementRequest(
    associationId: number,
    memberId: number,
    data: {
      fundId: number;
      amount: number;
      deceasedName: string;
      relationship: string;
      dateOfDeath: string;
      supportingDocuments?: string;
    }
  ) {
    const reason = `Bereavement support for ${data.deceasedName} (${data.relationship}). Date of death: ${data.dateOfDeath}`;

    return this.createPayoutRequest(associationId, memberId, {
      fundId: data.fundId,
      payoutType: 'BEREAVEMENT',
      amount: data.amount,
      reason,
      supportingDocuments: data.supportingDocuments,
    });
  },
};
