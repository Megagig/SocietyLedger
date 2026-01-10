import { prisma } from '../../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================
// DONATION SERVICE (TASK-ADV-003, TASK-ADV-004)
// ============================================

export const donationsService = {
  /**
   * Generate unique donation receipt number
   */
  async generateReceiptNumber(associationId: number): Promise<string> {
    const count = await prisma.donationRecord.count({
      where: {
        transaction: { associationId },
      },
    });
    const year = new Date().getFullYear();
    return `DON-${year}-${String(count + 1).padStart(6, '0')}`;
  },

  /**
   * Create donation allocation (fund/project)
   */
  async createAllocation(
    associationId: number,
    userId: number,
    data: {
      name: string;
      description?: string;
      type: 'general' | 'project' | 'emergency' | 'other';
      targetAmount?: number;
    }
  ) {
    const allocation = await prisma.donationAllocation.create({
      data: {
        associationId,
        name: data.name,
        description: data.description,
        type: data.type,
        targetAmount: data.targetAmount,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        associationId,
        userId,
        action: 'CREATE',
        tableName: 'donation_allocations',
        recordId: allocation.id,
        newValues: allocation,
      },
    });

    return allocation;
  },

  /**
   * List all donation allocations
   */
  async listAllocations(
    associationId: number,
    options: {
      type?: string;
      isActive?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { associationId };
    if (options.type) where.type = options.type;
    if (options.isActive !== undefined) where.isActive = options.isActive;

    const [allocations, totalCount] = await Promise.all([
      prisma.donationAllocation.findMany({
        where,
        include: {
          donations: {
            include: {
              transaction: {
                include: {
                  payments: { select: { amountPaid: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.donationAllocation.count({ where }),
    ]);

    // Calculate totals for each allocation
    const allocationsWithTotals = allocations.map(allocation => {
      let totalDonated = new Decimal(0);
      
      allocation.donations.forEach(donation => {
        const paid = donation.transaction.payments.reduce(
          (sum, p) => sum.plus(p.amountPaid),
          new Decimal(0)
        );
        totalDonated = totalDonated.plus(paid);
      });

      const progressPercentage = allocation.targetAmount && allocation.targetAmount.greaterThan(0)
        ? totalDonated.dividedBy(allocation.targetAmount).times(100).toNumber()
        : null;

      return {
        id: allocation.id,
        name: allocation.name,
        description: allocation.description,
        type: allocation.type,
        targetAmount: allocation.targetAmount,
        isActive: allocation.isActive,
        createdAt: allocation.createdAt,
        stats: {
          totalDonated: totalDonated.toNumber(),
          donationCount: allocation.donations.length,
          progressPercentage: progressPercentage ? Math.min(progressPercentage, 100) : null,
          remaining: allocation.targetAmount 
            ? Math.max(0, allocation.targetAmount.minus(totalDonated).toNumber())
            : null,
        },
      };
    });

    return {
      allocations: allocationsWithTotals,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + allocations.length < totalCount,
      },
    };
  },

  /**
   * Update allocation
   */
  async updateAllocation(
    allocationId: number,
    associationId: number,
    userId: number,
    data: {
      name?: string;
      description?: string;
      type?: string;
      targetAmount?: number;
      isActive?: boolean;
    }
  ) {
    const existing = await prisma.donationAllocation.findFirst({
      where: { id: allocationId, associationId },
    });

    if (!existing) {
      throw new Error('Allocation not found');
    }

    const updated = await prisma.donationAllocation.update({
      where: { id: allocationId },
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        targetAmount: data.targetAmount,
        isActive: data.isActive,
      },
    });

    await prisma.auditLog.create({
      data: {
        associationId,
        userId,
        action: 'UPDATE',
        tableName: 'donation_allocations',
        recordId: allocationId,
        oldValues: existing,
        newValues: updated,
      },
    });

    return updated;
  },

  /**
   * Record a donation with receipt generation (TASK-ADV-003)
   * Supports both instant donations (with immediate payment) and pledges (to be redeemed later)
   */
  async recordDonation(
    associationId: number,
    userId: number,
    data: {
      memberId: number;
      categoryId: number;
      amount: number;
      allocationId?: number;
      donorMessage?: string;
      isAnonymous?: boolean;
      paymentMethod?: string;
      notes?: string;
      donationType?: 'instant' | 'pledge'; // New field: instant = immediate payment, pledge = future redemption
      pledgeDate?: string; // Expected redemption date for pledges
    }
  ) {
    // Default to instant if not specified (backward compatibility)
    const donationType = data.donationType || 'instant';
    
    // Verify member exists
    const member = await prisma.member.findFirst({
      where: { id: data.memberId, associationId },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    // Verify category is donation type
    const category = await prisma.financialCategory.findFirst({
      where: { id: data.categoryId, associationId, type: 'donation', isActive: true },
    });

    if (!category) {
      throw new Error('Donation category not found or inactive');
    }

    // Verify allocation if provided
    if (data.allocationId) {
      const allocation = await prisma.donationAllocation.findFirst({
        where: { id: data.allocationId, associationId, isActive: true },
      });

      if (!allocation) {
        throw new Error('Donation allocation not found or inactive');
      }
    }

    // Helper function to generate unique receipt number with timestamp and random suffix
    const generateUniqueReceiptNumber = () => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      return `RCP${timestamp}${random}`;
    };

    // Helper function to generate unique transaction reference
    const generateUniqueTransactionRef = () => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      return `TXN${timestamp}${random}`;
    };

    // Generate receipt number for donation record
    const receiptNumber = await this.generateReceiptNumber(associationId);

    // Determine transaction status and dates based on donation type
    const isInstant = donationType === 'instant';
    const transactionStatus = isInstant ? 'paid' : 'pending';
    const paymentDate = isInstant ? new Date() : null;
    const dueDate = data.pledgeDate ? new Date(data.pledgeDate) : null;

    // Create transaction, payment (if instant), and donation record in a single transaction
    // Increase timeout for slow database connections (e.g., Neon cold starts)
    const result = await prisma.$transaction(async (tx) => {
      // Generate unique reference numbers inside transaction to avoid race conditions
      const transactionRef = generateUniqueTransactionRef();

      // Create the transaction
      const transaction = await tx.transaction.create({
        data: {
          associationId,
          memberId: data.memberId,
          categoryId: data.categoryId,
          amount: data.amount,
          referenceNumber: transactionRef,
          status: transactionStatus,
          paymentDate,
          dueDate,
          paymentMethod: isInstant ? (data.paymentMethod || 'cash') : null,
          notes: data.notes || `${isInstant ? 'Donation' : 'Donation Pledge'}: ${category.name}`,
          createdBy: userId,
        },
      });

      // Only create payment record for instant donations
      let payment = null;
      if (isInstant) {
        const paymentReceiptNumber = generateUniqueReceiptNumber();
        payment = await tx.payment.create({
          data: {
            associationId,
            transactionId: transaction.id,
            amountPaid: data.amount,
            paymentDate: new Date(),
            paymentMethod: data.paymentMethod || 'cash',
            receiptNumber: paymentReceiptNumber,
            confirmedBy: userId,
            confirmedAt: new Date(),
          },
        });
      }

      // Create donation record with receipt
      const donationRecord = await tx.donationRecord.create({
        data: {
          transactionId: transaction.id,
          allocationId: data.allocationId,
          receiptNumber,
          donorMessage: data.donorMessage,
          isAnonymous: data.isAnonymous || false,
        },
        include: {
          allocation: { select: { id: true, name: true, type: true } },
          transaction: {
            include: {
              member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
              category: { select: { id: true, name: true } },
            },
          },
        },
      });

      return { transaction, payment, donationRecord };
    }, {
      maxWait: 30000, // Maximum time to wait for transaction to start (30 seconds)
      timeout: 30000, // Maximum time for transaction to complete (30 seconds)
    });

    await prisma.auditLog.create({
      data: {
        associationId,
        userId,
        action: isInstant ? 'RECORD_DONATION' : 'RECORD_PLEDGE',
        tableName: 'donation_records',
        recordId: result.donationRecord.id,
        newValues: {
          transactionId: result.transaction.id,
          amount: data.amount,
          receiptNumber,
          allocationId: data.allocationId,
          donationType,
          pledgeDate: data.pledgeDate,
        },
      },
    });

    return {
      ...result,
      donationType,
      member: {
        id: member.id,
        memberId: member.memberId,
        name: `${member.firstName} ${member.lastName}`,
        email: member.email,
      },
      category: {
        id: category.id,
        name: category.name,
      },
    };
  },

  /**
   * Get donation receipt data (TASK-ADV-003)
   */
  async getDonationReceipt(donationId: number, associationId: number) {
    const donation = await prisma.donationRecord.findFirst({
      where: { id: donationId },
      include: {
        transaction: {
          include: {
            member: {
              select: {
                id: true,
                memberId: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                address: true,
              },
            },
            category: { select: { id: true, name: true } },
            payments: {
              select: { amountPaid: true, paymentDate: true, paymentMethod: true },
            },
            association: {
              select: { id: true, name: true, logo: true, primaryColor: true },
            },
          },
        },
        allocation: { select: { id: true, name: true, type: true } },
      },
    });

    if (!donation || donation.transaction.associationId !== associationId) {
      throw new Error('Donation not found');
    }

    const totalPaid = donation.transaction.payments.reduce(
      (sum, p) => sum.plus(p.amountPaid),
      new Decimal(0)
    );

    return {
      receiptNumber: donation.receiptNumber,
      donationDate: donation.createdAt,
      amount: totalPaid.toNumber(),
      donor: donation.isAnonymous
        ? { name: 'Anonymous Donor' }
        : {
            id: donation.transaction.member.id,
            memberId: donation.transaction.member.memberId,
            name: `${donation.transaction.member.firstName} ${donation.transaction.member.lastName}`,
            email: donation.transaction.member.email,
            phone: donation.transaction.member.phone,
            address: donation.transaction.member.address,
          },
      category: donation.transaction.category.name,
      allocation: donation.allocation,
      donorMessage: donation.donorMessage,
      association: donation.transaction.association,
      paymentMethod: donation.transaction.payments[0]?.paymentMethod || 'N/A',
    };
  },

  /**
   * Get donation by transaction ID
   */
  async getDonationByTransactionId(transactionId: number, associationId: number) {
    const donation = await prisma.donationRecord.findFirst({
      where: { transactionId },
      include: {
        transaction: {
          include: {
            member: {
              select: { id: true, memberId: true, firstName: true, lastName: true },
            },
            category: { select: { id: true, name: true } },
            payments: { select: { amountPaid: true, paymentDate: true } },
          },
        },
        allocation: { select: { id: true, name: true, type: true } },
      },
    });

    if (!donation || donation.transaction.associationId !== associationId) {
      return null;
    }

    return donation;
  },

  /**
   * List all donations
   */
  async listDonations(
    associationId: number,
    options: {
      allocationId?: number;
      memberId?: number;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      transaction: { associationId },
    };

    if (options.allocationId) {
      where.allocationId = options.allocationId;
    }

    if (options.memberId) {
      where.transaction.memberId = options.memberId;
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const [donations, totalCount] = await Promise.all([
      prisma.donationRecord.findMany({
        where,
        include: {
          transaction: {
            include: {
              member: {
                select: { id: true, memberId: true, firstName: true, lastName: true },
              },
              category: { select: { id: true, name: true } },
              payments: { select: { amountPaid: true } },
            },
          },
          allocation: { select: { id: true, name: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.donationRecord.count({ where }),
    ]);

    const donationsWithAmount = donations.map(d => ({
      id: d.id,
      receiptNumber: d.receiptNumber,
      amount: new Decimal(d.transaction.amount).toNumber(),
      paidAmount: d.transaction.payments.reduce(
        (sum, p) => sum.plus(p.amountPaid),
        new Decimal(0)
      ).toNumber(),
      status: d.transaction.status,
      donor: d.isAnonymous
        ? { name: 'Anonymous' }
        : {
            id: d.transaction.member.id,
            memberId: d.transaction.member.memberId,
            name: `${d.transaction.member.firstName} ${d.transaction.member.lastName}`,
          },
      category: d.transaction.category.name,
      allocation: d.allocation,
      donorMessage: d.donorMessage,
      createdAt: d.createdAt,
    }));

    return {
      donations: donationsWithAmount,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + donations.length < totalCount,
      },
    };
  },

  /**
   * Get donation statistics
   */
  async getDonationStats(associationId: number, dateRange?: { start: Date; end: Date }) {
    const where: any = {
      transaction: { associationId },
    };

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    const donations = await prisma.donationRecord.findMany({
      where,
      include: {
        transaction: {
          include: {
            payments: { select: { amountPaid: true } },
          },
        },
        allocation: { select: { id: true, name: true, type: true } },
      },
    });

    let totalAmount = new Decimal(0);
    const byAllocation: Record<string, { name: string; amount: Decimal; count: number }> = {};
    const byType: Record<string, { amount: Decimal; count: number }> = {};

    donations.forEach(d => {
      // Use transaction amount (not payments) to include pledges
      const amount = new Decimal(d.transaction.amount);
      totalAmount = totalAmount.plus(amount);

      // By allocation
      const allocName = d.allocation?.name || 'Unallocated';
      if (!byAllocation[allocName]) {
        byAllocation[allocName] = { name: allocName, amount: new Decimal(0), count: 0 };
      }
      byAllocation[allocName].amount = byAllocation[allocName].amount.plus(amount);
      byAllocation[allocName].count++;

      // By type
      const allocType = d.allocation?.type || 'general';
      if (!byType[allocType]) {
        byType[allocType] = { amount: new Decimal(0), count: 0 };
      }
      byType[allocType].amount = byType[allocType].amount.plus(amount);
      byType[allocType].count++;
    });

    return {
      totalDonations: donations.length,
      totalAmount: totalAmount.toNumber(),
      byAllocation: Object.values(byAllocation).map(a => ({
        name: a.name,
        amount: a.amount.toNumber(),
        count: a.count,
      })),
      byType: Object.entries(byType).map(([type, data]) => ({
        type,
        amount: data.amount.toNumber(),
        count: data.count,
      })),
    };
  },
};
