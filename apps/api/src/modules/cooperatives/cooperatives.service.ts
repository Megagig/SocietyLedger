import { prisma } from '../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import {
  SavingsAccountInput,
  SavingsAccountResponse,
  SavingsTransactionInput,
  SavingsTransactionResponse,
  LoanProductInput,
  LoanProductResponse,
  LoanApplicationInput,
  LoanApplicationResponse,
  LoanGuarantorResponse,
  LoanResponse,
  LoanRepaymentInput,
  LoanRepaymentResponse,
  LoanRepaymentScheduleItem,
  CooperativeDashboard,
  MemberCooperativeProfile,
} from './cooperatives.types';
// Accounting integration
import { accountingIntegrationService } from '../../services/accounting-integration.service';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate unique savings account number
 */
async function generateSavingsAccountNumber(associationId: number): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await prisma.savingsAccount.count({
    where: { associationId },
  });
  return `SAV-${year}-${String(count + 1).padStart(6, '0')}`;
}

/**
 * Generate unique loan application number
 */
async function generateLoanApplicationNumber(associationId: number): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const count = await prisma.loanApplication.count({
    where: { associationId },
  });
  return `LA-${year}${month}-${String(count + 1).padStart(5, '0')}`;
}

/**
 * Generate unique loan number
 */
async function generateLoanNumber(associationId: number): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await prisma.loan.count({
    where: { associationId },
  });
  return `LN-${year}-${String(count + 1).padStart(6, '0')}`;
}

/**
 * Calculate loan repayment details based on interest type
 */
function calculateLoanRepayment(
  principal: number,
  annualInterestRate: number,
  tenureMonths: number,
  interestType: string
): { monthlyRepayment: number; totalRepayment: number; totalInterest: number } {
  const monthlyRate = annualInterestRate / 100 / 12;

  if (interestType === 'FLAT') {
    // Flat rate: Interest calculated on original principal
    const totalInterest = principal * (annualInterestRate / 100) * (tenureMonths / 12);
    const totalRepayment = principal + totalInterest;
    const monthlyRepayment = totalRepayment / tenureMonths;
    return { monthlyRepayment, totalRepayment, totalInterest };
  } else if (interestType === 'REDUCING_BALANCE') {
    // Reducing balance: EMI formula
    if (monthlyRate === 0) {
      return {
        monthlyRepayment: principal / tenureMonths,
        totalRepayment: principal,
        totalInterest: 0,
      };
    }
    const monthlyRepayment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
      (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    const totalRepayment = monthlyRepayment * tenureMonths;
    const totalInterest = totalRepayment - principal;
    return { monthlyRepayment, totalRepayment, totalInterest };
  } else {
    // Compound interest
    const totalRepayment = principal * Math.pow(1 + monthlyRate, tenureMonths);
    const totalInterest = totalRepayment - principal;
    const monthlyRepayment = totalRepayment / tenureMonths;
    return { monthlyRepayment, totalRepayment, totalInterest };
  }
}

/**
 * Generate amortization schedule for reducing balance loans
 */
function generateAmortizationSchedule(
  principal: number,
  annualInterestRate: number,
  tenureMonths: number,
  interestType: string,
  startDate: Date
): Array<{
  installmentNumber: number;
  dueDate: Date;
  principalDue: number;
  interestDue: number;
  totalDue: number;
}> {
  const schedule: Array<{
    installmentNumber: number;
    dueDate: Date;
    principalDue: number;
    interestDue: number;
    totalDue: number;
  }> = [];

  const monthlyRate = annualInterestRate / 100 / 12;
  let remainingPrincipal = principal;

  const { monthlyRepayment } = calculateLoanRepayment(
    principal,
    annualInterestRate,
    tenureMonths,
    interestType
  );

  for (let i = 1; i <= tenureMonths; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    let interestDue: number;
    let principalDue: number;

    if (interestType === 'FLAT') {
      // Flat rate: Equal principal + fixed interest portion
      principalDue = principal / tenureMonths;
      interestDue = (principal * (annualInterestRate / 100)) / 12;
    } else {
      // Reducing balance
      interestDue = remainingPrincipal * monthlyRate;
      principalDue = monthlyRepayment - interestDue;
    }

    // Handle last installment rounding
    if (i === tenureMonths) {
      principalDue = remainingPrincipal;
    }

    schedule.push({
      installmentNumber: i,
      dueDate,
      principalDue: Math.round(principalDue * 100) / 100,
      interestDue: Math.round(interestDue * 100) / 100,
      totalDue: Math.round((principalDue + interestDue) * 100) / 100,
    });

    remainingPrincipal -= principalDue;
  }

  return schedule;
}

// ============================================
// COOPERATIVES SERVICE
// ============================================

export const cooperativesService = {
  // ==========================================
  // SAVINGS ACCOUNT MANAGEMENT
  // ==========================================

  /**
   * Create a new savings account for a member
   */
  async createSavingsAccount(
    associationId: number,
    data: SavingsAccountInput
  ): Promise<SavingsAccountResponse> {
    // Verify member belongs to association
    const member = await prisma.member.findFirst({
      where: { id: data.memberId, associationId },
    });

    if (!member) {
      throw new Error('Member not found in this association');
    }

    const accountNumber = await generateSavingsAccountNumber(associationId);

    const account = await prisma.savingsAccount.create({
      data: {
        associationId,
        memberId: data.memberId,
        accountNumber,
        accountType: data.accountType || 'REGULAR',
        targetAmount: data.targetAmount ? new Decimal(data.targetAmount) : null,
        monthlyContribution: data.monthlyContribution
          ? new Decimal(data.monthlyContribution)
          : null,
        interestRate: new Decimal(data.interestRate || 0),
        maturityDate: data.maturityDate ? new Date(data.maturityDate) : null,
        notes: data.notes,
      },
      include: {
        member: { select: { firstName: true, lastName: true } },
      },
    });

    return this.formatSavingsAccountResponse(account);
  },

  /**
   * Get savings accounts with pagination and filters
   */
  async getSavingsAccounts(
    associationId: number,
    options: {
      page?: number;
      limit?: number;
      memberId?: number;
      accountType?: string;
      status?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ accounts: SavingsAccountResponse[]; pagination: any }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = { associationId };

    if (options.memberId) whereClause.memberId = options.memberId;
    if (options.accountType) whereClause.accountType = options.accountType;
    if (options.status) whereClause.status = options.status;
    if (options.search) {
      whereClause.OR = [
        { accountNumber: { contains: options.search, mode: 'insensitive' } },
        { member: { firstName: { contains: options.search, mode: 'insensitive' } } },
        { member: { lastName: { contains: options.search, mode: 'insensitive' } } },
      ];
    }

    const [accounts, totalCount] = await Promise.all([
      prisma.savingsAccount.findMany({
        where: whereClause,
        include: {
          member: { select: { firstName: true, lastName: true } },
        },
        orderBy: { [options.sortBy || 'openedAt']: options.sortOrder || 'desc' },
        skip,
        take: limit,
      }),
      prisma.savingsAccount.count({ where: whereClause }),
    ]);

    return {
      accounts: accounts.map(a => this.formatSavingsAccountResponse(a)),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + accounts.length < totalCount,
      },
    };
  },

  /**
   * Get a single savings account
   */
  async getSavingsAccount(
    associationId: number,
    accountId: number
  ): Promise<SavingsAccountResponse | null> {
    const account = await prisma.savingsAccount.findFirst({
      where: { id: accountId, associationId },
      include: {
        member: { select: { firstName: true, lastName: true } },
      },
    });

    return account ? this.formatSavingsAccountResponse(account) : null;
  },

  /**
   * Process a savings transaction (deposit/withdrawal)
   */
  async processSavingsTransaction(
    associationId: number,
    userId: number,
    data: SavingsTransactionInput
  ): Promise<SavingsTransactionResponse> {
    const account = await prisma.savingsAccount.findFirst({
      where: { id: data.savingsAccountId, associationId, status: 'ACTIVE' },
    });

    if (!account) {
      throw new Error('Savings account not found or inactive');
    }

    const amount = new Decimal(data.amount);

    // Validate withdrawal
    if (data.type === 'WITHDRAWAL' && account.balance.lessThan(amount)) {
      throw new Error('Insufficient balance for withdrawal');
    }

    // Calculate new balance
    let newBalance: Decimal;
    let totalDeposits = account.totalDeposits;
    let totalWithdrawals = account.totalWithdrawals;

    if (['DEPOSIT', 'INTEREST', 'TRANSFER_IN'].includes(data.type)) {
      newBalance = account.balance.plus(amount);
      if (data.type === 'DEPOSIT') {
        totalDeposits = totalDeposits.plus(amount);
      }
    } else {
      newBalance = account.balance.minus(amount);
      if (data.type === 'WITHDRAWAL') {
        totalWithdrawals = totalWithdrawals.plus(amount);
      }
    }

    // Create transaction and update account in a transaction
    const [transaction] = await prisma.$transaction([
      prisma.savingsTransaction.create({
        data: {
          associationId,
          savingsAccountId: data.savingsAccountId,
          type: data.type as any,
          amount,
          balanceAfter: newBalance,
          paymentMethod: data.paymentMethod,
          reference: data.reference,
          processedBy: userId,
          notes: data.notes,
        },
        include: {
          processor: { select: { email: true } },
        },
      }),
      prisma.savingsAccount.update({
        where: { id: data.savingsAccountId },
        data: {
          balance: newBalance,
          totalDeposits,
          totalWithdrawals,
        },
      }),
    ]);

    // Accounting integration: Sync savings transaction to accounting module
    try {
      // Fetch full account details for accounting sync
      const fullAccount = await prisma.savingsAccount.findUnique({
        where: { id: data.savingsAccountId },
        include: {
          member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
        },
      });
      
      if (fullAccount) {
        if (data.type === 'DEPOSIT') {
          await accountingIntegrationService.onSavingsDeposit(transaction, fullAccount, userId);
        } else if (data.type === 'WITHDRAWAL') {
          await accountingIntegrationService.onSavingsWithdrawal(transaction, fullAccount, userId);
        }
      }
    } catch (syncError) {
      console.error('Accounting sync failed (non-critical):', syncError);
      // Don't throw - transaction succeeded
    }

    return this.formatSavingsTransactionResponse(transaction);
  },

  /**
   * Get savings transactions
   */
  async getSavingsTransactions(
    associationId: number,
    options: {
      page?: number;
      limit?: number;
      savingsAccountId?: number;
      type?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ transactions: SavingsTransactionResponse[]; pagination: any }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = { associationId };

    if (options.savingsAccountId) whereClause.savingsAccountId = options.savingsAccountId;
    if (options.type) whereClause.type = options.type;
    if (options.startDate && options.endDate) {
      whereClause.createdAt = {
        gte: options.startDate,
        lte: options.endDate,
      };
    }

    const [transactions, totalCount] = await Promise.all([
      prisma.savingsTransaction.findMany({
        where: whereClause,
        include: {
          processor: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.savingsTransaction.count({ where: whereClause }),
    ]);

    return {
      transactions: transactions.map(t => this.formatSavingsTransactionResponse(t)),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + transactions.length < totalCount,
      },
    };
  },

  // ==========================================
  // LOAN PRODUCT MANAGEMENT
  // ==========================================

  /**
   * Create a loan product
   */
  async createLoanProduct(
    associationId: number,
    data: LoanProductInput
  ): Promise<LoanProductResponse> {
    const product = await prisma.loanProduct.create({
      data: {
        associationId,
        name: data.name,
        description: data.description,
        minAmount: new Decimal(data.minAmount),
        maxAmount: new Decimal(data.maxAmount),
        interestRate: new Decimal(data.interestRate),
        interestType: data.interestType as any,
        minTenureMonths: data.minTenureMonths,
        maxTenureMonths: data.maxTenureMonths,
        processingFeePercent: new Decimal(data.processingFeePercent || 0),
        processingFeeFixed: new Decimal(data.processingFeeFixed || 0),
        requiresGuarantor: data.requiresGuarantor,
        minGuarantors: data.minGuarantors || 1,
        maxLoanToSavingsRatio: data.maxLoanToSavingsRatio
          ? new Decimal(data.maxLoanToSavingsRatio)
          : null,
        gracePeriodDays: data.gracePeriodDays || 0,
        lateFeePercent: new Decimal(data.lateFeePercent || 0),
        lateFeeFixed: new Decimal(data.lateFeeFixed || 0),
        isActive: data.isActive !== false,
      },
    });

    return this.formatLoanProductResponse(product);
  },

  /**
   * Get loan products
   */
  async getLoanProducts(
    associationId: number,
    options: {
      page?: number;
      limit?: number;
      isActive?: boolean;
      search?: string;
    } = {}
  ): Promise<{ products: LoanProductResponse[]; pagination: any }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = { associationId };

    if (options.isActive !== undefined) whereClause.isActive = options.isActive;
    if (options.search) {
      whereClause.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [products, totalCount] = await Promise.all([
      prisma.loanProduct.findMany({
        where: whereClause,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.loanProduct.count({ where: whereClause }),
    ]);

    return {
      products: products.map(p => this.formatLoanProductResponse(p)),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + products.length < totalCount,
      },
    };
  },

  /**
   * Update a loan product
   */
  async updateLoanProduct(
    associationId: number,
    productId: number,
    data: Partial<LoanProductInput>
  ): Promise<LoanProductResponse> {
    const product = await prisma.loanProduct.findFirst({
      where: { id: productId, associationId },
    });

    if (!product) {
      throw new Error('Loan product not found');
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.minAmount) updateData.minAmount = new Decimal(data.minAmount);
    if (data.maxAmount) updateData.maxAmount = new Decimal(data.maxAmount);
    if (data.interestRate) updateData.interestRate = new Decimal(data.interestRate);
    if (data.interestType) updateData.interestType = data.interestType;
    if (data.minTenureMonths) updateData.minTenureMonths = data.minTenureMonths;
    if (data.maxTenureMonths) updateData.maxTenureMonths = data.maxTenureMonths;
    if (data.processingFeePercent !== undefined)
      updateData.processingFeePercent = new Decimal(data.processingFeePercent);
    if (data.processingFeeFixed !== undefined)
      updateData.processingFeeFixed = new Decimal(data.processingFeeFixed);
    if (data.requiresGuarantor !== undefined) updateData.requiresGuarantor = data.requiresGuarantor;
    if (data.minGuarantors !== undefined) updateData.minGuarantors = data.minGuarantors;
    if (data.maxLoanToSavingsRatio !== undefined)
      updateData.maxLoanToSavingsRatio = data.maxLoanToSavingsRatio
        ? new Decimal(data.maxLoanToSavingsRatio)
        : null;
    if (data.gracePeriodDays !== undefined) updateData.gracePeriodDays = data.gracePeriodDays;
    if (data.lateFeePercent !== undefined)
      updateData.lateFeePercent = new Decimal(data.lateFeePercent);
    if (data.lateFeeFixed !== undefined) updateData.lateFeeFixed = new Decimal(data.lateFeeFixed);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await prisma.loanProduct.update({
      where: { id: productId },
      data: updateData,
    });

    return this.formatLoanProductResponse(updated);
  },


  // ==========================================
  // LOAN APPLICATION MANAGEMENT
  // ==========================================

  /**
   * Create a loan application
   */
  async createLoanApplication(
    associationId: number,
    memberId: number,
    data: LoanApplicationInput
  ): Promise<LoanApplicationResponse> {
    // Verify member belongs to association
    const member = await prisma.member.findFirst({
      where: { id: memberId, associationId },
    });

    if (!member) {
      throw new Error('Member not found in this association');
    }

    // Get loan product
    const product = await prisma.loanProduct.findFirst({
      where: { id: data.loanProductId, associationId, isActive: true },
    });

    if (!product) {
      throw new Error('Loan product not found or inactive');
    }

    // Validate amount
    if (data.amount < product.minAmount.toNumber() || data.amount > product.maxAmount.toNumber()) {
      throw new Error(
        `Loan amount must be between ${product.minAmount} and ${product.maxAmount}`
      );
    }

    // Validate tenure
    if (data.tenureMonths < product.minTenureMonths || data.tenureMonths > product.maxTenureMonths) {
      throw new Error(
        `Loan tenure must be between ${product.minTenureMonths} and ${product.maxTenureMonths} months`
      );
    }

    // Check loan-to-savings ratio if applicable
    if (product.maxLoanToSavingsRatio) {
      const totalSavings = await prisma.savingsAccount.aggregate({
        where: { memberId, associationId, status: 'ACTIVE' },
        _sum: { balance: true },
      });

      const savingsBalance = totalSavings._sum.balance?.toNumber() || 0;
      const maxLoanAmount = savingsBalance * product.maxLoanToSavingsRatio.toNumber();

      if (data.amount > maxLoanAmount) {
        throw new Error(
          `Loan amount exceeds maximum allowed based on savings (${maxLoanAmount.toFixed(2)})`
        );
      }
    }

    // Calculate repayment details
    const { monthlyRepayment, totalRepayment, totalInterest } = calculateLoanRepayment(
      data.amount,
      product.interestRate.toNumber(),
      data.tenureMonths,
      product.interestType
    );

    // Calculate processing fee
    const processingFee =
      (data.amount * product.processingFeePercent.toNumber()) / 100 +
      product.processingFeeFixed.toNumber();

    const applicationNumber = await generateLoanApplicationNumber(associationId);

    // Determine initial status
    const initialStatus =
      product.requiresGuarantor && data.guarantorIds && data.guarantorIds.length > 0
        ? 'PENDING_GUARANTORS'
        : product.requiresGuarantor
        ? 'DRAFT'
        : 'PENDING_REVIEW';

    const application = await prisma.loanApplication.create({
      data: {
        associationId,
        applicationNumber,
        memberId,
        loanProductId: data.loanProductId,
        amount: new Decimal(data.amount),
        tenureMonths: data.tenureMonths,
        interestRate: product.interestRate,
        interestType: product.interestType,
        monthlyRepayment: new Decimal(monthlyRepayment),
        totalRepayment: new Decimal(totalRepayment),
        totalInterest: new Decimal(totalInterest),
        processingFee: new Decimal(processingFee),
        purpose: data.purpose,
        status: initialStatus as any,
        collateralDescription: data.collateralDescription,
        collateralValue: data.collateralValue ? new Decimal(data.collateralValue) : null,
      },
      include: {
        member: { select: { firstName: true, lastName: true } },
        loanProduct: { select: { name: true } },
        guarantors: {
          include: {
            guarantorMember: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    // Add guarantors if provided
    if (data.guarantorIds && data.guarantorIds.length > 0) {
      const guaranteeAmountPerPerson = data.amount / data.guarantorIds.length;

      await prisma.loanGuarantor.createMany({
        data: data.guarantorIds.map(guarantorMemberId => ({
          associationId,
          loanApplicationId: application.id,
          guarantorMemberId,
          guaranteeAmount: new Decimal(guaranteeAmountPerPerson),
        })),
      });
    }

    // Fetch updated application with guarantors
    const updatedApplication = await prisma.loanApplication.findUnique({
      where: { id: application.id },
      include: {
        member: { select: { firstName: true, lastName: true } },
        loanProduct: { select: { name: true } },
        guarantors: {
          include: {
            guarantorMember: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return this.formatLoanApplicationResponse(updatedApplication!);
  },

  /**
   * Get loan applications
   */
  async getLoanApplications(
    associationId: number,
    options: {
      page?: number;
      limit?: number;
      memberId?: number;
      status?: string;
      loanProductId?: number;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ applications: LoanApplicationResponse[]; pagination: any }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = { associationId };

    if (options.memberId) whereClause.memberId = options.memberId;
    if (options.status) whereClause.status = options.status;
    if (options.loanProductId) whereClause.loanProductId = options.loanProductId;
    if (options.startDate && options.endDate) {
      whereClause.appliedAt = {
        gte: options.startDate,
        lte: options.endDate,
      };
    }
    if (options.search) {
      whereClause.OR = [
        { applicationNumber: { contains: options.search, mode: 'insensitive' } },
        { member: { firstName: { contains: options.search, mode: 'insensitive' } } },
        { member: { lastName: { contains: options.search, mode: 'insensitive' } } },
      ];
    }

    const [applications, totalCount] = await Promise.all([
      prisma.loanApplication.findMany({
        where: whereClause,
        include: {
          member: { select: { firstName: true, lastName: true } },
          loanProduct: { select: { name: true } },
          guarantors: {
            include: {
              guarantorMember: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { [options.sortBy || 'appliedAt']: options.sortOrder || 'desc' },
        skip,
        take: limit,
      }),
      prisma.loanApplication.count({ where: whereClause }),
    ]);

    return {
      applications: applications.map(a => this.formatLoanApplicationResponse(a)),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + applications.length < totalCount,
      },
    };
  },

  /**
   * Get a single loan application
   */
  async getLoanApplication(
    associationId: number,
    applicationId: number
  ): Promise<LoanApplicationResponse | null> {
    const application = await prisma.loanApplication.findFirst({
      where: { id: applicationId, associationId },
      include: {
        member: { select: { firstName: true, lastName: true } },
        loanProduct: { select: { name: true } },
        guarantors: {
          include: {
            guarantorMember: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return application ? this.formatLoanApplicationResponse(application) : null;
  },

  /**
   * Review a loan application (approve/reject)
   */
  async reviewLoanApplication(
    associationId: number,
    applicationId: number,
    userId: number,
    action: 'approve' | 'reject' | 'request_info',
    comments?: string,
    rejectionReason?: string
  ): Promise<LoanApplicationResponse> {
    const application = await prisma.loanApplication.findFirst({
      where: { id: applicationId, associationId },
      include: {
        loanProduct: true,
        guarantors: true,
      },
    });

    if (!application) {
      throw new Error('Loan application not found');
    }

    // Validate status for review
    const reviewableStatuses = ['PENDING_REVIEW', 'UNDER_REVIEW', 'PENDING_APPROVAL'];
    if (!reviewableStatuses.includes(application.status)) {
      throw new Error(`Cannot review application in ${application.status} status`);
    }

    // Check guarantor requirements
    if (action === 'approve' && application.loanProduct.requiresGuarantor) {
      const acceptedGuarantors = application.guarantors.filter(g => g.status === 'ACCEPTED');
      if (acceptedGuarantors.length < application.loanProduct.minGuarantors) {
        throw new Error(
          `Application requires at least ${application.loanProduct.minGuarantors} accepted guarantors`
        );
      }
    }

    let updateData: any = {
      reviewedBy: userId,
      reviewedAt: new Date(),
      reviewComments: comments,
    };

    if (action === 'approve') {
      updateData.status = 'APPROVED';
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
    } else if (action === 'reject') {
      updateData.status = 'REJECTED';
      updateData.rejectionReason = rejectionReason;
    } else {
      updateData.status = 'UNDER_REVIEW';
    }

    await prisma.loanApplication.update({
      where: { id: applicationId },
      data: updateData,
    });

    return (await this.getLoanApplication(associationId, applicationId))!;
  },

  /**
   * Disburse an approved loan
   */
  async disburseLoan(
    associationId: number,
    applicationId: number,
    userId: number,
    disbursementMethod: string,
    options: {
      bankAccountId?: number;
      savingsAccountId?: number;
      reference?: string;
      notes?: string;
    } = {}
  ): Promise<LoanResponse> {
    const application = await prisma.loanApplication.findFirst({
      where: { id: applicationId, associationId, status: 'APPROVED' },
      include: {
        loanProduct: true,
        member: { select: { firstName: true, lastName: true } },
      },
    });

    if (!application) {
      throw new Error('Approved loan application not found');
    }

    const loanNumber = await generateLoanNumber(associationId);
    const disbursedAt = new Date();
    const maturityDate = new Date(disbursedAt);
    maturityDate.setMonth(maturityDate.getMonth() + application.tenureMonths);

    // Calculate amount to disburse (principal minus processing fee)
    const amountDisbursed = application.amount.minus(application.processingFee);

    // Generate repayment schedule
    const schedule = generateAmortizationSchedule(
      application.amount.toNumber(),
      application.interestRate.toNumber(),
      application.tenureMonths,
      application.interestType,
      disbursedAt
    );

    // Create loan and schedule in a transaction
    const loan = await prisma.$transaction(async tx => {
      // Update application status
      await tx.loanApplication.update({
        where: { id: applicationId },
        data: {
          status: 'DISBURSED',
          disbursedAt,
        },
      });

      // Create loan
      const newLoan = await tx.loan.create({
        data: {
          associationId,
          loanNumber,
          applicationId,
          memberId: application.memberId,
          loanProductId: application.loanProductId,
          principalAmount: application.amount,
          interestRate: application.interestRate,
          interestType: application.interestType,
          tenureMonths: application.tenureMonths,
          monthlyRepayment: application.monthlyRepayment,
          totalRepayment: application.totalRepayment,
          totalInterest: application.totalInterest,
          processingFee: application.processingFee,
          amountDisbursed,
          outstandingBalance: application.totalRepayment,
          nextPaymentDate: schedule[0]?.dueDate,
          nextPaymentAmount: schedule[0] ? new Decimal(schedule[0].totalDue) : null,
          disbursedAt,
          maturityDate,
        },
      });

      // Create repayment schedule
      await tx.loanRepaymentSchedule.createMany({
        data: schedule.map(item => ({
          loanId: newLoan.id,
          installmentNumber: item.installmentNumber,
          dueDate: item.dueDate,
          principalDue: new Decimal(item.principalDue),
          interestDue: new Decimal(item.interestDue),
          totalDue: new Decimal(item.totalDue),
        })),
      });

      // If disbursing to savings account, credit it
      if (disbursementMethod === 'savings_credit' && options.savingsAccountId) {
        const savingsAccount = await tx.savingsAccount.findFirst({
          where: { id: options.savingsAccountId, memberId: application.memberId },
        });

        if (savingsAccount) {
          const newBalance = savingsAccount.balance.plus(amountDisbursed);
          await tx.savingsAccount.update({
            where: { id: options.savingsAccountId },
            data: {
              balance: newBalance,
              totalDeposits: savingsAccount.totalDeposits.plus(amountDisbursed),
            },
          });

          await tx.savingsTransaction.create({
            data: {
              associationId,
              savingsAccountId: options.savingsAccountId,
              type: 'TRANSFER_IN',
              amount: amountDisbursed,
              balanceAfter: newBalance,
              reference: `Loan disbursement - ${loanNumber}`,
              processedBy: userId,
              notes: `Loan ${loanNumber} disbursement`,
            },
          });
        }
      }

      return newLoan;
    });

    // Accounting integration: Sync loan disbursement to accounting module
    try {
      // Fetch full loan with application details for accounting sync
      const fullLoan = await prisma.loan.findUnique({
        where: { id: loan.id },
        include: {
          application: {
            include: {
              member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
            },
          },
        },
      });
      
      if (fullLoan && fullLoan.application) {
        await accountingIntegrationService.onLoanDisbursed(fullLoan, fullLoan.application, userId);
      }
    } catch (syncError) {
      console.error('Accounting sync failed (non-critical):', syncError);
      // Don't throw - loan disbursement succeeded
    }

    return (await this.getLoan(associationId, loan.id))!;
  },


  // ==========================================
  // GUARANTOR MANAGEMENT
  // ==========================================

  /**
   * Respond to a guarantor request
   */
  async respondToGuarantorRequest(
    associationId: number,
    guarantorId: number,
    memberId: number,
    action: 'accept' | 'decline',
    declineReason?: string
  ): Promise<LoanGuarantorResponse> {
    const guarantor = await prisma.loanGuarantor.findFirst({
      where: {
        id: guarantorId,
        associationId,
        guarantorMember: { userId: memberId },
        status: 'PENDING',
      },
      include: {
        loanApplication: true,
        guarantorMember: { select: { firstName: true, lastName: true } },
      },
    });

    if (!guarantor) {
      throw new Error('Guarantor request not found or already processed');
    }

    const updateData: any = {};

    if (action === 'accept') {
      updateData.status = 'ACCEPTED';
      updateData.acceptedAt = new Date();
    } else {
      updateData.status = 'DECLINED';
      updateData.declinedAt = new Date();
      updateData.declineReason = declineReason;
    }

    const updated = await prisma.loanGuarantor.update({
      where: { id: guarantorId },
      data: updateData,
      include: {
        guarantorMember: { select: { firstName: true, lastName: true } },
      },
    });

    // Check if all required guarantors have accepted
    if (action === 'accept') {
      const application = await prisma.loanApplication.findUnique({
        where: { id: guarantor.loanApplicationId },
        include: {
          loanProduct: true,
          guarantors: true,
        },
      });

      if (application && application.status === 'PENDING_GUARANTORS') {
        const acceptedCount = application.guarantors.filter(g => g.status === 'ACCEPTED').length;
        if (acceptedCount >= application.loanProduct.minGuarantors) {
          await prisma.loanApplication.update({
            where: { id: application.id },
            data: { status: 'PENDING_REVIEW' },
          });
        }
      }
    }

    return this.formatLoanGuarantorResponse(updated);
  },

  /**
   * Get pending guarantor requests for a member
   */
  async getPendingGuarantorRequests(
    associationId: number,
    memberId: number
  ): Promise<LoanGuarantorResponse[]> {
    const guarantors = await prisma.loanGuarantor.findMany({
      where: {
        associationId,
        guarantorMemberId: memberId,
        status: 'PENDING',
      },
      include: {
        guarantorMember: { select: { firstName: true, lastName: true } },
        loanApplication: {
          include: {
            member: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return guarantors.map(g => this.formatLoanGuarantorResponse(g));
  },

  // ==========================================
  // ACTIVE LOAN MANAGEMENT
  // ==========================================

  /**
   * Get active loans
   */
  async getLoans(
    associationId: number,
    options: {
      page?: number;
      limit?: number;
      memberId?: number;
      status?: string;
      loanProductId?: number;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ loans: LoanResponse[]; pagination: any }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = { associationId };

    if (options.memberId) whereClause.memberId = options.memberId;
    if (options.status) whereClause.status = options.status;
    if (options.loanProductId) whereClause.loanProductId = options.loanProductId;
    if (options.search) {
      whereClause.OR = [
        { loanNumber: { contains: options.search, mode: 'insensitive' } },
        { member: { firstName: { contains: options.search, mode: 'insensitive' } } },
        { member: { lastName: { contains: options.search, mode: 'insensitive' } } },
      ];
    }

    const [loans, totalCount] = await Promise.all([
      prisma.loan.findMany({
        where: whereClause,
        include: {
          member: { select: { firstName: true, lastName: true } },
          loanProduct: { select: { name: true } },
          repaymentSchedule: { orderBy: { installmentNumber: 'asc' } },
        },
        orderBy: { [options.sortBy || 'disbursedAt']: options.sortOrder || 'desc' },
        skip,
        take: limit,
      }),
      prisma.loan.count({ where: whereClause }),
    ]);

    return {
      loans: loans.map(l => this.formatLoanResponse(l)),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + loans.length < totalCount,
      },
    };
  },

  /**
   * Get a single loan
   */
  async getLoan(associationId: number, loanId: number): Promise<LoanResponse | null> {
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, associationId },
      include: {
        member: { select: { firstName: true, lastName: true } },
        loanProduct: { select: { name: true } },
        repaymentSchedule: { orderBy: { installmentNumber: 'asc' } },
      },
    });

    return loan ? this.formatLoanResponse(loan) : null;
  },

  /**
   * Process a loan repayment
   */
  async processLoanRepayment(
    associationId: number,
    userId: number,
    data: LoanRepaymentInput
  ): Promise<LoanRepaymentResponse> {
    const loan = await prisma.loan.findFirst({
      where: { id: data.loanId, associationId, status: { in: ['ACTIVE', 'OVERDUE'] } },
      include: {
        repaymentSchedule: {
          where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
          orderBy: { dueDate: 'asc' },
        },
        loanProduct: true,
      },
    });

    if (!loan) {
      throw new Error('Active loan not found');
    }

    let remainingAmount = new Decimal(data.amount);
    let totalPrincipalPaid = new Decimal(0);
    let totalInterestPaid = new Decimal(0);
    let totalLateFee = new Decimal(0);
    let scheduleItemId: number | null = null;

    // Apply payment to schedule items
    const scheduleUpdates: Array<{
      id: number;
      principalPaid: Decimal;
      interestPaid: Decimal;
      totalPaid: Decimal;
      status: string;
      paidAt?: Date;
    }> = [];

    for (const scheduleItem of loan.repaymentSchedule) {
      if (remainingAmount.lessThanOrEqualTo(0)) break;

      const principalRemaining = scheduleItem.principalDue.minus(scheduleItem.principalPaid);
      const interestRemaining = scheduleItem.interestDue.minus(scheduleItem.interestPaid);
      const totalRemaining = principalRemaining.plus(interestRemaining).plus(scheduleItem.lateFee);

      if (totalRemaining.lessThanOrEqualTo(0)) continue;

      if (!scheduleItemId) scheduleItemId = scheduleItem.id;

      // Pay interest first, then principal
      let interestPayment = Decimal.min(remainingAmount, interestRemaining);
      remainingAmount = remainingAmount.minus(interestPayment);

      let principalPayment = Decimal.min(remainingAmount, principalRemaining);
      remainingAmount = remainingAmount.minus(principalPayment);

      // Pay late fee if any
      let lateFeePayment = Decimal.min(remainingAmount, scheduleItem.lateFee);
      remainingAmount = remainingAmount.minus(lateFeePayment);

      totalPrincipalPaid = totalPrincipalPaid.plus(principalPayment);
      totalInterestPaid = totalInterestPaid.plus(interestPayment);
      totalLateFee = totalLateFee.plus(lateFeePayment);

      const newPrincipalPaid = scheduleItem.principalPaid.plus(principalPayment);
      const newInterestPaid = scheduleItem.interestPaid.plus(interestPayment);
      const newTotalPaid = scheduleItem.totalPaid.plus(principalPayment).plus(interestPayment);

      const isPaid = newPrincipalPaid.greaterThanOrEqualTo(scheduleItem.principalDue) &&
                     newInterestPaid.greaterThanOrEqualTo(scheduleItem.interestDue);

      scheduleUpdates.push({
        id: scheduleItem.id,
        principalPaid: newPrincipalPaid,
        interestPaid: newInterestPaid,
        totalPaid: newTotalPaid,
        status: isPaid ? 'PAID' : 'PARTIAL',
        paidAt: isPaid ? new Date() : undefined,
      });
    }

    // Create repayment and update loan in a transaction
    const repayment = await prisma.$transaction(async tx => {
      // Create repayment record
      const newRepayment = await tx.loanRepayment.create({
        data: {
          associationId,
          loanId: data.loanId,
          scheduleItemId,
          amount: new Decimal(data.amount),
          principalPortion: totalPrincipalPaid,
          interestPortion: totalInterestPaid,
          lateFee: totalLateFee,
          paymentMethod: data.paymentMethod,
          reference: data.reference,
          processedBy: userId,
          notes: data.notes,
        },
        include: {
          processor: { select: { email: true } },
        },
      });

      // Update schedule items
      for (const update of scheduleUpdates) {
        await tx.loanRepaymentSchedule.update({
          where: { id: update.id },
          data: {
            principalPaid: update.principalPaid,
            interestPaid: update.interestPaid,
            totalPaid: update.totalPaid,
            status: update.status as any,
            paidAt: update.paidAt,
          },
        });
      }

      // Update loan totals
      const newTotalPaid = loan.totalPaid.plus(data.amount);
      const newPrincipalPaid = loan.principalPaid.plus(totalPrincipalPaid);
      const newInterestPaid = loan.interestPaid.plus(totalInterestPaid);
      const newOutstandingBalance = loan.outstandingBalance.minus(totalPrincipalPaid).minus(totalInterestPaid);

      // Find next payment
      const nextScheduleItem = await tx.loanRepaymentSchedule.findFirst({
        where: { loanId: data.loanId, status: { in: ['PENDING', 'PARTIAL'] } },
        orderBy: { dueDate: 'asc' },
      });

      const isPaidOff = newOutstandingBalance.lessThanOrEqualTo(0);

      await tx.loan.update({
        where: { id: data.loanId },
        data: {
          totalPaid: newTotalPaid,
          principalPaid: newPrincipalPaid,
          interestPaid: newInterestPaid,
          outstandingBalance: isPaidOff ? new Decimal(0) : newOutstandingBalance,
          nextPaymentDate: nextScheduleItem?.dueDate || null,
          nextPaymentAmount: nextScheduleItem
            ? nextScheduleItem.totalDue.minus(nextScheduleItem.totalPaid)
            : null,
          status: isPaidOff ? 'PAID_OFF' : loan.status,
          closedAt: isPaidOff ? new Date() : null,
        },
      });

      return newRepayment;
    });

    // Accounting integration: Sync loan repayment to accounting module
    try {
      // Fetch full loan details for accounting sync
      const fullLoan = await prisma.loan.findUnique({
        where: { id: data.loanId },
        include: {
          member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
        },
      });
      
      if (fullLoan) {
        await accountingIntegrationService.onLoanRepayment(repayment, fullLoan, userId);
      }
    } catch (syncError) {
      console.error('Accounting sync failed (non-critical):', syncError);
      // Don't throw - repayment succeeded
    }

    return this.formatLoanRepaymentResponse(repayment);
  },

  /**
   * Get loan repayments
   */
  async getLoanRepayments(
    associationId: number,
    options: {
      page?: number;
      limit?: number;
      loanId?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ repayments: LoanRepaymentResponse[]; pagination: any }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = { associationId };

    if (options.loanId) whereClause.loanId = options.loanId;
    if (options.startDate && options.endDate) {
      whereClause.paidAt = {
        gte: options.startDate,
        lte: options.endDate,
      };
    }

    const [repayments, totalCount] = await Promise.all([
      prisma.loanRepayment.findMany({
        where: whereClause,
        include: {
          processor: { select: { email: true } },
        },
        orderBy: { paidAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.loanRepayment.count({ where: whereClause }),
    ]);

    return {
      repayments: repayments.map(r => this.formatLoanRepaymentResponse(r)),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + repayments.length < totalCount,
      },
    };
  },


  // ==========================================
  // DASHBOARD & STATISTICS
  // ==========================================

  /**
   * Get cooperative dashboard statistics
   */
  async getDashboard(associationId: number): Promise<CooperativeDashboard> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Savings summary
    const [
      savingsStats,
      depositsThisMonth,
      withdrawalsThisMonth,
    ] = await Promise.all([
      prisma.savingsAccount.aggregate({
        where: { associationId },
        _count: { id: true },
        _sum: { balance: true },
      }),
      prisma.savingsTransaction.aggregate({
        where: {
          associationId,
          type: 'DEPOSIT',
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      prisma.savingsTransaction.aggregate({
        where: {
          associationId,
          type: 'WITHDRAWAL',
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    const activeAccounts = await prisma.savingsAccount.count({
      where: { associationId, status: 'ACTIVE' },
    });

    // Loans summary
    const [
      loansStats,
      overdueLoans,
      repaymentsThisMonth,
    ] = await Promise.all([
      prisma.loan.aggregate({
        where: { associationId, status: { in: ['ACTIVE', 'OVERDUE'] } },
        _count: { id: true },
        _sum: { principalAmount: true, outstandingBalance: true },
      }),
      prisma.loan.aggregate({
        where: { associationId, status: 'OVERDUE' },
        _count: { id: true },
        _sum: { outstandingBalance: true },
      }),
      prisma.loanRepayment.aggregate({
        where: {
          associationId,
          paidAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    // Pending actions
    const [
      pendingApplications,
      pendingGuarantors,
      overdueRepayments,
    ] = await Promise.all([
      prisma.loanApplication.count({
        where: { associationId, status: { in: ['PENDING_REVIEW', 'PENDING_APPROVAL'] } },
      }),
      prisma.loanGuarantor.count({
        where: { associationId, status: 'PENDING' },
      }),
      prisma.loanRepaymentSchedule.count({
        where: {
          loan: { associationId },
          status: 'OVERDUE',
        },
      }),
    ]);

    // Recent activity
    const [recentDeposits, recentRepayments, recentApplications] = await Promise.all([
      prisma.savingsTransaction.findMany({
        where: { associationId, type: 'DEPOSIT' },
        include: { processor: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.loanRepayment.findMany({
        where: { associationId },
        include: { processor: { select: { email: true } } },
        orderBy: { paidAt: 'desc' },
        take: 5,
      }),
      prisma.loanApplication.findMany({
        where: { associationId },
        include: {
          member: { select: { firstName: true, lastName: true } },
          loanProduct: { select: { name: true } },
          guarantors: {
            include: { guarantorMember: { select: { firstName: true, lastName: true } } },
          },
        },
        orderBy: { appliedAt: 'desc' },
        take: 5,
      }),
    ]);

    // Calculate default rate
    const totalLoansEver = await prisma.loan.count({ where: { associationId } });
    const defaultedLoans = await prisma.loan.count({
      where: { associationId, status: 'DEFAULTED' },
    });
    const defaultRate = totalLoansEver > 0 ? (defaultedLoans / totalLoansEver) * 100 : 0;

    const totalBalance = savingsStats._sum.balance || new Decimal(0);
    const avgBalance = activeAccounts > 0
      ? totalBalance.dividedBy(activeAccounts)
      : new Decimal(0);

    return {
      savingsSummary: {
        totalAccounts: savingsStats._count.id,
        activeAccounts,
        totalBalance,
        totalDepositsThisMonth: depositsThisMonth._sum.amount || new Decimal(0),
        totalWithdrawalsThisMonth: withdrawalsThisMonth._sum.amount || new Decimal(0),
        averageBalance: avgBalance,
      },
      loansSummary: {
        totalActiveLoans: loansStats._count.id,
        totalDisbursed: loansStats._sum.principalAmount || new Decimal(0),
        totalOutstanding: loansStats._sum.outstandingBalance || new Decimal(0),
        totalCollectedThisMonth: repaymentsThisMonth._sum.amount || new Decimal(0),
        overdueLoans: overdueLoans._count.id,
        overdueAmount: overdueLoans._sum.outstandingBalance || new Decimal(0),
        defaultRate,
      },
      pendingActions: {
        pendingLoanApplications: pendingApplications,
        pendingGuarantorRequests: pendingGuarantors,
        overdueRepayments,
      },
      recentActivity: {
        recentDeposits: recentDeposits.map(d => this.formatSavingsTransactionResponse(d)),
        recentRepayments: recentRepayments.map(r => this.formatLoanRepaymentResponse(r)),
        recentApplications: recentApplications.map(a => this.formatLoanApplicationResponse(a)),
      },
    };
  },

  /**
   * Get member's cooperative profile
   */
  async getMemberCooperativeProfile(
    associationId: number,
    memberId: number
  ): Promise<MemberCooperativeProfile | null> {
    const member = await prisma.member.findFirst({
      where: { id: memberId, associationId },
    });

    if (!member) return null;

    // Get savings accounts
    const savingsAccounts = await prisma.savingsAccount.findMany({
      where: { memberId, associationId },
      include: { member: { select: { firstName: true, lastName: true } } },
    });

    // Get active loans
    const loans = await prisma.loan.findMany({
      where: { memberId, associationId, status: { in: ['ACTIVE', 'OVERDUE'] } },
      include: {
        member: { select: { firstName: true, lastName: true } },
        loanProduct: { select: { name: true } },
        repaymentSchedule: { orderBy: { installmentNumber: 'asc' } },
      },
    });

    // Get guaranteed loans
    const guaranteedLoans = await prisma.loanGuarantor.findMany({
      where: { guarantorMemberId: memberId, associationId, status: 'ACCEPTED' },
      include: {
        guarantorMember: { select: { firstName: true, lastName: true } },
        loanApplication: {
          include: { loan: true },
        },
      },
    });

    // Calculate totals
    const totalSavings = savingsAccounts.reduce(
      (sum, acc) => sum.plus(acc.balance),
      new Decimal(0)
    );

    const totalOutstandingLoans = loans.reduce(
      (sum, loan) => sum.plus(loan.outstandingBalance),
      new Decimal(0)
    );

    const guarantorExposure = guaranteedLoans
      .filter(g => g.loanApplication.loan && g.loanApplication.loan.status === 'ACTIVE')
      .reduce((sum, g) => sum.plus(g.guaranteeAmount), new Decimal(0));

    // Get eligible loan products
    const loanProducts = await prisma.loanProduct.findMany({
      where: { associationId, isActive: true },
    });

    const eligibleProducts: any[] = [];
    const eligibilityReasons: string[] = [];

    for (const product of loanProducts) {
      let isEligible = true;
      const reasons: string[] = [];

      // Check loan-to-savings ratio
      if (product.maxLoanToSavingsRatio) {
        const maxAmount = totalSavings.times(product.maxLoanToSavingsRatio);
        if (maxAmount.lessThan(product.minAmount)) {
          isEligible = false;
          reasons.push(`Insufficient savings for ${product.name}`);
        }
      }

      // Check existing loans
      const existingLoans = loans.filter(l => l.loanProductId === product.id);
      if (existingLoans.length > 0) {
        isEligible = false;
        reasons.push(`Already has active ${product.name} loan`);
      }

      if (isEligible) {
        eligibleProducts.push(this.formatLoanProductResponse(product));
      }
      eligibilityReasons.push(...reasons);
    }

    // Calculate max loan amount based on savings
    const maxLoanAmount = loanProducts.reduce((max, product) => {
      if (product.maxLoanToSavingsRatio) {
        const productMax = totalSavings.times(product.maxLoanToSavingsRatio);
        return Decimal.max(max, Decimal.min(productMax, product.maxAmount));
      }
      return Decimal.max(max, product.maxAmount);
    }, new Decimal(0));

    // Simple credit score calculation (0-100)
    let creditScore = 50; // Base score
    
    // Positive factors
    if (totalSavings.greaterThan(0)) creditScore += 10;
    if (savingsAccounts.length > 0) creditScore += 5;
    
    // Check payment history
    const paidLoans = await prisma.loan.count({
      where: { memberId, associationId, status: 'PAID_OFF' },
    });
    creditScore += Math.min(paidLoans * 5, 20);

    // Negative factors
    const overdueSchedules = await prisma.loanRepaymentSchedule.count({
      where: {
        loan: { memberId, associationId },
        status: 'OVERDUE',
      },
    });
    creditScore -= Math.min(overdueSchedules * 5, 30);

    creditScore = Math.max(0, Math.min(100, creditScore));

    return {
      memberId,
      memberName: `${member.firstName} ${member.lastName}`,
      savingsAccounts: savingsAccounts.map(a => this.formatSavingsAccountResponse(a)),
      totalSavings,
      activeLoans: loans.map(l => this.formatLoanResponse(l)),
      totalOutstandingLoans,
      guarantorExposure,
      guaranteedLoans: guaranteedLoans.map(g => this.formatLoanGuarantorResponse(g)),
      loanEligibility: {
        maxLoanAmount,
        eligibleProducts,
        reasons: eligibilityReasons,
      },
      creditScore,
      memberSince: member.joinDate || member.createdAt,
    };
  },

  // ==========================================
  // FORMAT HELPERS
  // ==========================================

  formatSavingsAccountResponse(account: any): SavingsAccountResponse {
    return {
      id: account.id,
      memberId: account.memberId,
      memberName: account.member
        ? `${account.member.firstName} ${account.member.lastName}`
        : '',
      accountNumber: account.accountNumber,
      accountType: account.accountType,
      balance: account.balance,
      targetAmount: account.targetAmount,
      monthlyContribution: account.monthlyContribution,
      interestRate: account.interestRate,
      accruedInterest: account.accruedInterest,
      totalDeposits: account.totalDeposits,
      totalWithdrawals: account.totalWithdrawals,
      status: account.status,
      maturityDate: account.maturityDate,
      openedAt: account.openedAt,
      closedAt: account.closedAt,
      notes: account.notes,
    };
  },

  formatSavingsTransactionResponse(transaction: any): SavingsTransactionResponse {
    return {
      id: transaction.id,
      savingsAccountId: transaction.savingsAccountId,
      type: transaction.type,
      amount: transaction.amount,
      balanceAfter: transaction.balanceAfter,
      paymentMethod: transaction.paymentMethod,
      reference: transaction.reference,
      processedBy: transaction.processedBy,
      processedByName: transaction.processor?.email || '',
      notes: transaction.notes,
      createdAt: transaction.createdAt,
    };
  },

  formatLoanProductResponse(product: any): LoanProductResponse {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      minAmount: product.minAmount,
      maxAmount: product.maxAmount,
      interestRate: product.interestRate,
      interestType: product.interestType,
      minTenureMonths: product.minTenureMonths,
      maxTenureMonths: product.maxTenureMonths,
      processingFeePercent: product.processingFeePercent,
      processingFeeFixed: product.processingFeeFixed,
      requiresGuarantor: product.requiresGuarantor,
      minGuarantors: product.minGuarantors,
      maxLoanToSavingsRatio: product.maxLoanToSavingsRatio,
      gracePeriodDays: product.gracePeriodDays,
      lateFeePercent: product.lateFeePercent,
      lateFeeFixed: product.lateFeeFixed,
      isActive: product.isActive,
      createdAt: product.createdAt,
    };
  },

  formatLoanApplicationResponse(application: any): LoanApplicationResponse {
    return {
      id: application.id,
      applicationNumber: application.applicationNumber,
      memberId: application.memberId,
      memberName: application.member
        ? `${application.member.firstName} ${application.member.lastName}`
        : '',
      loanProductId: application.loanProductId,
      loanProductName: application.loanProduct?.name || '',
      amount: application.amount,
      tenureMonths: application.tenureMonths,
      interestRate: application.interestRate,
      interestType: application.interestType,
      monthlyRepayment: application.monthlyRepayment,
      totalRepayment: application.totalRepayment,
      totalInterest: application.totalInterest,
      processingFee: application.processingFee,
      purpose: application.purpose,
      status: application.status,
      collateralDescription: application.collateralDescription,
      collateralValue: application.collateralValue,
      guarantors: (application.guarantors || []).map((g: any) =>
        this.formatLoanGuarantorResponse(g)
      ),
      appliedAt: application.appliedAt,
      reviewedBy: application.reviewedBy,
      reviewedAt: application.reviewedAt,
      approvedBy: application.approvedBy,
      approvedAt: application.approvedAt,
      rejectionReason: application.rejectionReason,
      disbursedAt: application.disbursedAt,
    };
  },

  formatLoanGuarantorResponse(guarantor: any): LoanGuarantorResponse {
    return {
      id: guarantor.id,
      loanApplicationId: guarantor.loanApplicationId,
      guarantorMemberId: guarantor.guarantorMemberId,
      guarantorName: guarantor.guarantorMember
        ? `${guarantor.guarantorMember.firstName} ${guarantor.guarantorMember.lastName}`
        : '',
      guaranteeAmount: guarantor.guaranteeAmount,
      status: guarantor.status,
      acceptedAt: guarantor.acceptedAt,
      declinedAt: guarantor.declinedAt,
      declineReason: guarantor.declineReason,
    };
  },

  formatLoanResponse(loan: any): LoanResponse {
    return {
      id: loan.id,
      loanNumber: loan.loanNumber,
      applicationId: loan.applicationId,
      memberId: loan.memberId,
      memberName: loan.member
        ? `${loan.member.firstName} ${loan.member.lastName}`
        : '',
      loanProductId: loan.loanProductId,
      loanProductName: loan.loanProduct?.name || '',
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate,
      interestType: loan.interestType,
      tenureMonths: loan.tenureMonths,
      monthlyRepayment: loan.monthlyRepayment,
      totalRepayment: loan.totalRepayment,
      totalInterest: loan.totalInterest,
      processingFee: loan.processingFee,
      amountDisbursed: loan.amountDisbursed,
      totalPaid: loan.totalPaid,
      principalPaid: loan.principalPaid,
      interestPaid: loan.interestPaid,
      outstandingBalance: loan.outstandingBalance,
      nextPaymentDate: loan.nextPaymentDate,
      nextPaymentAmount: loan.nextPaymentAmount,
      status: loan.status,
      disbursedAt: loan.disbursedAt,
      maturityDate: loan.maturityDate,
      closedAt: loan.closedAt,
      repaymentSchedule: (loan.repaymentSchedule || []).map((item: any) => ({
        id: item.id,
        loanId: item.loanId,
        installmentNumber: item.installmentNumber,
        dueDate: item.dueDate,
        principalDue: item.principalDue,
        interestDue: item.interestDue,
        totalDue: item.totalDue,
        principalPaid: item.principalPaid,
        interestPaid: item.interestPaid,
        totalPaid: item.totalPaid,
        lateFee: item.lateFee,
        status: item.status,
        paidAt: item.paidAt,
      })),
    };
  },

  formatLoanRepaymentResponse(repayment: any): LoanRepaymentResponse {
    return {
      id: repayment.id,
      loanId: repayment.loanId,
      scheduleItemId: repayment.scheduleItemId,
      amount: repayment.amount,
      principalPortion: repayment.principalPortion,
      interestPortion: repayment.interestPortion,
      lateFee: repayment.lateFee,
      paymentMethod: repayment.paymentMethod,
      reference: repayment.reference,
      processedBy: repayment.processedBy,
      processedByName: repayment.processor?.email || '',
      notes: repayment.notes,
      paidAt: repayment.paidAt,
    };
  },
};
