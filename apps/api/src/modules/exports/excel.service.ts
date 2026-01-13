import ExcelJS from 'exceljs';
import { Decimal } from '@prisma/client/runtime/library';
import { AssociationBranding } from './exports.types';
import { reportsService } from '../reports/reports.service';

// ============================================
// EXCEL SERVICE
// ============================================

export const excelService = {
  /**
   * Format currency for Excel
   * Handles Decimal objects, numbers, and serialized Decimal strings
   */
  formatCurrency(amount: any): number {
    if (amount === null || amount === undefined) return 0;
    if (typeof amount === 'number') return amount;
    if (typeof amount === 'string') return parseFloat(amount) || 0;
    if (amount && typeof amount.toNumber === 'function') return amount.toNumber();
    if (amount && typeof amount === 'object' && 'd' in amount) {
      // Serialized Decimal object - reconstruct and convert
      return new Decimal(amount).toNumber();
    }
    return parseFloat(String(amount)) || 0;
  },

  /**
   * Format date for Excel
   */
  formatDate(date: Date | null | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-NG');
  },

  /**
   * Style header row
   */
  styleHeaderRow(row: ExcelJS.Row) {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1e40af' },
    };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 25;
  },

  /**
   * Add title section to worksheet
   */
  addTitleSection(
    worksheet: ExcelJS.Worksheet,
    branding: AssociationBranding,
    title: string,
    subtitle?: string
  ) {
    // Association name
    const titleRow = worksheet.addRow([branding.name]);
    titleRow.font = { size: 18, bold: true, color: { argb: 'FF1e40af' } };
    titleRow.height = 30;

    // Report title
    const reportTitleRow = worksheet.addRow([title]);
    reportTitleRow.font = { size: 14, bold: true };
    reportTitleRow.height = 25;

    // Subtitle (if provided)
    if (subtitle) {
      const subtitleRow = worksheet.addRow([subtitle]);
      subtitleRow.font = { size: 11, italic: true };
    }

    // Generated date
    const dateRow = worksheet.addRow([`Generated on: ${new Date().toLocaleString('en-NG')}`]);
    dateRow.font = { size: 10, color: { argb: 'FF666666' } };

    // Empty row
    worksheet.addRow([]);
  },

  /**
   * Generate Financial Summary Excel
   */
  async generateFinancialSummaryExcel(
    associationId: number,
    branding: AssociationBranding,
    filters: any,
    filepath: string
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();

    // Get report data
    const report = await reportsService.generateFinancialSummary(associationId, filters, true);

    // ===== SUMMARY SHEET =====
    const summarySheet = workbook.addWorksheet('Summary');

    this.addTitleSection(
      summarySheet,
      branding,
      'Financial Summary Report',
      `Period: ${report.period.label}`
    );

    // Summary metrics
    summarySheet.addRow(['Metric', 'Amount']);
    this.styleHeaderRow(summarySheet.lastRow!);

    const incomeTotal = this.formatCurrency(report.income.total);
    const expensesTotal = this.formatCurrency(report.expenses.total);
    const netAmount = incomeTotal - expensesTotal;
    const expectedCollections = this.formatCurrency(report.collections.expected);
    const collected = this.formatCurrency(report.collections.collected);
    const outstanding = this.formatCurrency(report.collections.outstanding);

    summarySheet.addRow(['Total Income', incomeTotal]);
    summarySheet.addRow(['Total Expenses', expensesTotal]);
    summarySheet.addRow(['Net', netAmount]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Expected Collections', expectedCollections]);
    summarySheet.addRow(['Collected', collected]);
    summarySheet.addRow(['Outstanding', outstanding]);
    summarySheet.addRow(['Collection Rate', `${report.collections.collectionRate.toFixed(2)}%`]);

    // Format currency columns - use simple number format first
    // summarySheet.getColumn(2).numFmt = '₦#,##0.00';
    summarySheet.getColumn(1).width = 30;
    summarySheet.getColumn(2).width = 20;

    // ===== INCOME BY CATEGORY SHEET =====
    if (report.income.byCategory.length > 0) {
      const incomeSheet = workbook.addWorksheet('Income by Category');

      this.addTitleSection(incomeSheet, branding, 'Income by Category');

      incomeSheet.addRow(['Category', 'Type', 'Transaction Count', 'Amount']);
      this.styleHeaderRow(incomeSheet.lastRow!);

      report.income.byCategory.forEach(cat => {
        incomeSheet.addRow([
          cat.categoryName,
          cat.categoryType,
          cat.transactionCount,
          this.formatCurrency(cat.amount),
        ]);
      });

      // Add total row
      const totalRow = incomeSheet.addRow([
        'TOTAL',
        '',
        report.income.byCategory.reduce((sum, cat) => sum + cat.transactionCount, 0),
        this.formatCurrency(report.income.total),
      ]);
      totalRow.font = { bold: true };

      // Format columns
      incomeSheet.getColumn(1).width = 25;
      incomeSheet.getColumn(2).width = 15;
      incomeSheet.getColumn(3).width = 18;
      incomeSheet.getColumn(4).width = 20;
      // incomeSheet.getColumn(4).numFmt = '₦#,##0.00';
    }

    // ===== EXPENSES BY CATEGORY SHEET =====
    if (report.expenses.byCategory.length > 0) {
      const expenseSheet = workbook.addWorksheet('Expenses by Category');

      this.addTitleSection(expenseSheet, branding, 'Expenses by Category');

      expenseSheet.addRow(['Category', 'Type', 'Transaction Count', 'Amount']);
      this.styleHeaderRow(expenseSheet.lastRow!);

      report.expenses.byCategory.forEach(cat => {
        expenseSheet.addRow([
          cat.categoryName,
          cat.categoryType,
          cat.transactionCount,
          this.formatCurrency(cat.amount),
        ]);
      });

      // Add total row
      const totalRow = expenseSheet.addRow([
        'TOTAL',
        '',
        report.expenses.byCategory.reduce((sum, cat) => sum + cat.transactionCount, 0),
        this.formatCurrency(report.expenses.total),
      ]);
      totalRow.font = { bold: true };

      // Format columns
      expenseSheet.getColumn(1).width = 25;
      expenseSheet.getColumn(2).width = 15;
      expenseSheet.getColumn(3).width = 18;
      expenseSheet.getColumn(4).width = 20;
      // Disabled currency format - causes display issues
      // expenseSheet.getColumn(4).numFmt = '₦#,##0.00';
    }

    // ===== COMPARISON SHEET =====
    if (report.comparison) {
      const comparisonSheet = workbook.addWorksheet('Period Comparison');

      this.addTitleSection(comparisonSheet, branding, 'Period Comparison');

      comparisonSheet.addRow(['Metric', 'Previous Period', 'Current Period', 'Change', 'Change %']);
      this.styleHeaderRow(comparisonSheet.lastRow!);

      comparisonSheet.addRow([
        'Income',
        this.formatCurrency(report.comparison.previousPeriod.income),
        this.formatCurrency(report.income.total),
        this.formatCurrency(report.comparison.changes.income.amount),
        `${report.comparison.changes.income.percentage.toFixed(2)}%`,
      ]);

      comparisonSheet.addRow([
        'Expenses',
        this.formatCurrency(report.comparison.previousPeriod.expenses),
        this.formatCurrency(report.expenses.total),
        this.formatCurrency(report.comparison.changes.expenses.amount),
        `${report.comparison.changes.expenses.percentage.toFixed(2)}%`,
      ]);

      comparisonSheet.addRow([
        'Collections',
        this.formatCurrency(report.comparison.previousPeriod.collections),
        this.formatCurrency(report.collections.collected),
        this.formatCurrency(report.comparison.changes.collections.amount),
        `${report.comparison.changes.collections.percentage.toFixed(2)}%`,
      ]);

      // Format columns
      comparisonSheet.getColumn(1).width = 20;
      comparisonSheet.getColumn(2).width = 20;
      comparisonSheet.getColumn(3).width = 20;
      comparisonSheet.getColumn(4).width = 15;
      comparisonSheet.getColumn(5).width = 15;
      // Disabled currency format - causes display issues
      // comparisonSheet.getColumn(2).numFmt = '₦#,##0.00';
      // comparisonSheet.getColumn(3).numFmt = '₦#,##0.00';
      // comparisonSheet.getColumn(4).numFmt = '₦#,##0.00';
    }

    // Save workbook
    await workbook.xlsx.writeFile(filepath);
  },

  /**
   * Generate All Members Excel
   */
  async generateAllMembersExcel(
    associationId: number,
    branding: AssociationBranding,
    filters: any,
    filepath: string
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();

    // Get member balances data
    const { members } = await reportsService.generateMemberBalances(associationId, {
      limit: 10000, // Get all members
      status: filters.status || 'all',
    });

    // ===== MEMBERS SHEET =====
    const membersSheet = workbook.addWorksheet('Members');

    this.addTitleSection(membersSheet, branding, 'All Members with Balances');

    // Headers
    membersSheet.addRow([
      'Member ID',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Total Dues',
      'Total Paid',
      'Balance',
      'Pending Transactions',
      'Overdue Transactions',
      'Last Payment Date',
      'Status',
    ]);
    this.styleHeaderRow(membersSheet.lastRow!);

    // Data rows
    members.forEach(member => {
      membersSheet.addRow([
        member.memberNumber,
        member.firstName,
        member.lastName,
        member.email || '',
        member.phone || '',
        this.formatCurrency(member.totalDues),
        this.formatCurrency(member.totalPaid),
        this.formatCurrency(member.balance),
        member.pendingTransactions,
        member.overdueTransactions,
        this.formatDate(member.lastPaymentDate),
        member.status.toUpperCase(),
      ]);
    });

    // Add summary row
    const totalDues = members.reduce((sum, m) => sum + this.formatCurrency(m.totalDues), 0);
    const totalPaid = members.reduce((sum, m) => sum + this.formatCurrency(m.totalPaid), 0);
    const totalBalance = members.reduce((sum, m) => sum + this.formatCurrency(m.balance), 0);

    membersSheet.addRow([]);
    const summaryRow = membersSheet.addRow([
      'TOTAL',
      '',
      '',
      '',
      '',
      totalDues,
      totalPaid,
      totalBalance,
      '',
      '',
      '',
      '',
    ]);
    summaryRow.font = { bold: true };

    // Format columns
    membersSheet.getColumn(1).width = 15;
    membersSheet.getColumn(2).width = 15;
    membersSheet.getColumn(3).width = 15;
    membersSheet.getColumn(4).width = 25;
    membersSheet.getColumn(5).width = 15;
    membersSheet.getColumn(6).width = 15;
    membersSheet.getColumn(7).width = 15;
    membersSheet.getColumn(8).width = 15;
    membersSheet.getColumn(9).width = 20;
    membersSheet.getColumn(10).width = 20;
    membersSheet.getColumn(11).width = 18;
    membersSheet.getColumn(12).width = 12;

    // Format currency columns - disabled to test
    // membersSheet.getColumn(6).numFmt = '₦#,##0.00';
    // membersSheet.getColumn(7).numFmt = '₦#,##0.00';
    // membersSheet.getColumn(8).numFmt = '₦#,##0.00';

    // Freeze header row
    membersSheet.views = [{ state: 'frozen', ySplit: 6 }];

    // ===== SUMMARY SHEET =====
    const summarySheet = workbook.addWorksheet('Summary');

    this.addTitleSection(summarySheet, branding, 'Members Summary');

    summarySheet.addRow(['Metric', 'Value']);
    this.styleHeaderRow(summarySheet.lastRow!);

    summarySheet.addRow(['Total Members', members.length]);
    summarySheet.addRow(['Members with Balance', members.filter(m => this.formatCurrency(m.balance) > 0).length]);
    summarySheet.addRow(['Members with Overdue', members.filter(m => m.overdueTransactions > 0).length]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Total Dues', totalDues]);
    summarySheet.addRow(['Total Paid', totalPaid]);
    summarySheet.addRow(['Total Outstanding', totalBalance]);
    summarySheet.addRow([
      'Collection Rate',
      totalDues > 0 ? `${((totalPaid / totalDues) * 100).toFixed(2)}%` : '0%',
    ]);

    summarySheet.getColumn(1).width = 25;
    summarySheet.getColumn(2).width = 20;
    // Disabled currency format - causes display issues
    // summarySheet.getColumn(2).numFmt = '₦#,##0.00';

    // Save workbook
    await workbook.xlsx.writeFile(filepath);
  },

  /**
   * Generate Custom Members Excel with selected fields
   */
  async generateCustomMembersExcel(
    associationId: number,
    branding: AssociationBranding,
    filters: any,
    filepath: string
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();

    // Get member balances data
    const { members } = await reportsService.generateMemberBalances(associationId, {
      limit: 10000, // Get all members
      status: filters.status || 'all',
    });

    // ===== MEMBERS SHEET =====
    const membersSheet = workbook.addWorksheet('Members');

    this.addTitleSection(membersSheet, branding, 'Custom Members Export');

    // Field mapping for headers and data extraction
    const fieldMapping: Record<string, { header: string; extractor: (member: any) => any; width?: number }> = {
      memberNumber: { header: 'Member ID', extractor: (m) => m.memberNumber, width: 15 },
      firstName: { header: 'First Name', extractor: (m) => m.firstName, width: 15 },
      lastName: { header: 'Last Name', extractor: (m) => m.lastName, width: 15 },
      email: { header: 'Email', extractor: (m) => m.email || '', width: 25 },
      phone: { header: 'Phone', extractor: (m) => m.phone || '', width: 15 },
      address: { header: 'Address', extractor: (m) => m.address || '', width: 30 },
      category: { header: 'Category', extractor: (m) => m.category || '', width: 12 },
      status: { header: 'Status', extractor: (m) => m.status?.toUpperCase() || '', width: 12 },
      joinDate: { header: 'Join Date', extractor: (m) => this.formatDate(m.joinDate), width: 15 },
      totalDues: { header: 'Total Dues', extractor: (m) => this.formatCurrency(m.totalDues), width: 15 },
      totalPaid: { header: 'Total Paid', extractor: (m) => this.formatCurrency(m.totalPaid), width: 15 },
      balance: { header: 'Balance', extractor: (m) => this.formatCurrency(m.balance), width: 15 },
      lastPaymentDate: { header: 'Last Payment Date', extractor: (m) => this.formatDate(m.lastPaymentDate), width: 18 },
      paymentMethod: { header: 'Payment Method', extractor: (m) => m.paymentMethod || '', width: 15 },
      emergencyContact: { header: 'Emergency Contact', extractor: (m) => m.emergencyContactName || '', width: 20 },
      emergencyPhone: { header: 'Emergency Phone', extractor: (m) => m.emergencyContactPhone || '', width: 15 },
    };

    const selectedFields = filters.fields || [];
    
    // Headers - only for selected fields
    const headers = selectedFields.map((field: string) => fieldMapping[field]?.header || field);
    membersSheet.addRow(headers);
    this.styleHeaderRow(membersSheet.lastRow!);

    // Data rows - only selected fields
    members.forEach(member => {
      const rowData = selectedFields.map((field: string) => {
        const mapping = fieldMapping[field];
        return mapping ? mapping.extractor(member) : '';
      });
      membersSheet.addRow(rowData);
    });

    // Format columns based on selected fields
    selectedFields.forEach((field: string, index: number) => {
      const mapping = fieldMapping[field];
      if (mapping?.width) {
        membersSheet.getColumn(index + 1).width = mapping.width;
      }
    });

    // Freeze header row
    membersSheet.views = [{ state: 'frozen', ySplit: 6 }];

    // ===== SUMMARY SHEET =====
    const summarySheet = workbook.addWorksheet('Summary');

    this.addTitleSection(summarySheet, branding, 'Export Summary');

    summarySheet.addRow(['Metric', 'Value']);
    this.styleHeaderRow(summarySheet.lastRow!);

    summarySheet.addRow(['Total Records', members.length]);
    summarySheet.addRow(['Selected Fields', selectedFields.length]);
    summarySheet.addRow(['Export Date', new Date().toLocaleDateString()]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Selected Fields:']);
    selectedFields.forEach((field: string) => {
      summarySheet.addRow(['', fieldMapping[field]?.header || field]);
    });

    summarySheet.getColumn(1).width = 25;
    summarySheet.getColumn(2).width = 20;

    // Save workbook
    await workbook.xlsx.writeFile(filepath);
  },

  /**
   * Generate Custom Report Excel with selected fields for different report types
   */
  async generateCustomReportExcel(
    associationId: number,
    branding: AssociationBranding,
    filters: any,
    filepath: string
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const { reportType, fields } = filters;

    // ===== MAIN DATA SHEET =====
    const dataSheet = workbook.addWorksheet(reportType.charAt(0).toUpperCase() + reportType.slice(1));
    this.addTitleSection(dataSheet, branding, `Custom ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Export`);

    let data: any[] = [];
    let fieldMapping: Record<string, { header: string; extractor: (item: any) => any; width?: number }> = {};

    // Get data and field mapping based on report type
    switch (reportType) {
      case 'transactions':
        data = await this.getTransactionsData(associationId);
        fieldMapping = {
          transactionId: { header: 'Transaction ID', extractor: (t) => t.id, width: 15 },
          memberNumber: { header: 'Member Number', extractor: (t) => t.member?.memberId || '', width: 15 },
          firstName: { header: 'First Name', extractor: (t) => t.member?.firstName || '', width: 15 },
          lastName: { header: 'Last Name', extractor: (t) => t.member?.lastName || '', width: 15 },
          email: { header: 'Email', extractor: (t) => t.member?.email || '', width: 25 },
          categoryName: { header: 'Category Name', extractor: (t) => t.category?.name || '', width: 20 },
          categoryType: { header: 'Category Type', extractor: (t) => t.category?.type || '', width: 15 },
          amount: { header: 'Amount', extractor: (t) => this.formatCurrency(t.amount), width: 15 },
          dueDate: { header: 'Due Date', extractor: (t) => this.formatDate(t.dueDate), width: 15 },
          status: { header: 'Status', extractor: (t) => t.status?.toUpperCase() || '', width: 12 },
          createdAt: { header: 'Created Date', extractor: (t) => this.formatDate(t.createdAt), width: 15 },
          description: { header: 'Description', extractor: (t) => t.description || '', width: 30 },
        };
        break;

      case 'payments':
        data = await this.getPaymentsData(associationId);
        fieldMapping = {
          paymentId: { header: 'Payment ID', extractor: (p) => p.id, width: 15 },
          memberNumber: { header: 'Member Number', extractor: (p) => p.transaction?.member?.memberId || '', width: 15 },
          firstName: { header: 'First Name', extractor: (p) => p.transaction?.member?.firstName || '', width: 15 },
          lastName: { header: 'Last Name', extractor: (p) => p.transaction?.member?.lastName || '', width: 15 },
          email: { header: 'Email', extractor: (p) => p.transaction?.member?.email || '', width: 25 },
          amount: { header: 'Amount', extractor: (p) => this.formatCurrency(p.amountPaid), width: 15 },
          paymentMethod: { header: 'Payment Method', extractor: (p) => p.paymentMethod || '', width: 15 },
          paymentDate: { header: 'Payment Date', extractor: (p) => this.formatDate(p.paymentDate), width: 15 },
          status: { header: 'Status', extractor: (p) => p.status?.toUpperCase() || '', width: 12 },
          reference: { header: 'Reference', extractor: (p) => p.reference || '', width: 20 },
        };
        break;

      case 'welfare':
        data = await this.getWelfareData(associationId);
        fieldMapping = {
          memberNumber: { header: 'Member Number', extractor: (w) => w.member?.memberId || '', width: 15 },
          firstName: { header: 'First Name', extractor: (w) => w.member?.firstName || '', width: 15 },
          lastName: { header: 'Last Name', extractor: (w) => w.member?.lastName || '', width: 15 },
          fundName: { header: 'Fund Name', extractor: (w) => w.fund?.name || '', width: 20 },
          contributionAmount: { header: 'Contribution Amount', extractor: (w) => this.formatCurrency(w.contributionAmount || 0), width: 18 },
          payoutAmount: { header: 'Payout Amount', extractor: (w) => this.formatCurrency(w.payoutAmount || 0), width: 15 },
          date: { header: 'Date', extractor: (w) => this.formatDate(w.date || w.createdAt), width: 15 },
          status: { header: 'Status', extractor: (w) => w.status?.toUpperCase() || '', width: 12 },
          reason: { header: 'Reason', extractor: (w) => w.reason || '', width: 30 },
        };
        break;

      case 'donations':
        data = await this.getDonationsData(associationId);
        fieldMapping = {
          memberNumber: { header: 'Member Number', extractor: (d) => d.member?.memberId || '', width: 15 },
          firstName: { header: 'First Name', extractor: (d) => d.member?.firstName || '', width: 15 },
          lastName: { header: 'Last Name', extractor: (d) => d.member?.lastName || '', width: 15 },
          categoryName: { header: 'Category Name', extractor: (d) => d.category?.name || '', width: 20 },
          amount: { header: 'Amount', extractor: (d) => this.formatCurrency(d.amount), width: 15 },
          donationDate: { header: 'Donation Date', extractor: (d) => this.formatDate(d.createdAt), width: 15 },
          allocationName: { header: 'Allocation', extractor: (d) => d.allocation?.name || '', width: 20 },
          status: { header: 'Status', extractor: (d) => d.status?.toUpperCase() || '', width: 12 },
        };
        break;

      case 'levies':
        data = await this.getLeviesData(associationId);
        fieldMapping = {
          memberNumber: { header: 'Member Number', extractor: (l) => l.member?.memberId || '', width: 15 },
          firstName: { header: 'First Name', extractor: (l) => l.member?.firstName || '', width: 15 },
          lastName: { header: 'Last Name', extractor: (l) => l.member?.lastName || '', width: 15 },
          categoryName: { header: 'Category Name', extractor: (l) => l.category?.name || '', width: 20 },
          amount: { header: 'Amount', extractor: (l) => this.formatCurrency(l.amount), width: 15 },
          dueDate: { header: 'Due Date', extractor: (l) => this.formatDate(l.dueDate), width: 15 },
          campaignName: { header: 'Campaign Name', extractor: (l) => l.campaign?.name || '', width: 20 },
          status: { header: 'Status', extractor: (l) => l.status?.toUpperCase() || '', width: 12 },
        };
        break;

      case 'penalties':
        data = await this.getPenaltiesData(associationId);
        fieldMapping = {
          memberNumber: { header: 'Member Number', extractor: (p) => p.member?.memberId || '', width: 15 },
          firstName: { header: 'First Name', extractor: (p) => p.member?.firstName || '', width: 15 },
          lastName: { header: 'Last Name', extractor: (p) => p.member?.lastName || '', width: 15 },
          penaltyType: { header: 'Penalty Type', extractor: (p) => p.rule?.name || '', width: 20 },
          amount: { header: 'Amount', extractor: (p) => this.formatCurrency(p.amount), width: 15 },
          appliedDate: { header: 'Applied Date', extractor: (p) => this.formatDate(p.appliedDate), width: 15 },
          reason: { header: 'Reason', extractor: (p) => p.reason || '', width: 30 },
          status: { header: 'Status', extractor: (p) => p.status?.toUpperCase() || '', width: 12 },
        };
        break;

      case 'accounting':
        data = await this.getAccountingData(associationId);
        fieldMapping = {
          entryId: { header: 'Entry ID', extractor: (a) => a.id, width: 15 },
          entryType: { header: 'Entry Type', extractor: (a) => a.entryType || '', width: 15 },
          category: { header: 'Category', extractor: (a) => a.category || '', width: 20 },
          subcategory: { header: 'Subcategory', extractor: (a) => a.subcategory || '', width: 20 },
          amount: { header: 'Amount', extractor: (a) => this.formatCurrency(a.amount), width: 15 },
          description: { header: 'Description', extractor: (a) => a.description || '', width: 30 },
          date: { header: 'Date', extractor: (a) => this.formatDate(a.date), width: 15 },
          reference: { header: 'Reference', extractor: (a) => a.reference || '', width: 20 },
        };
        break;

      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }

    // Headers - only for selected fields
    const headers = fields.map((field: string) => fieldMapping[field]?.header || field);
    dataSheet.addRow(headers);
    this.styleHeaderRow(dataSheet.lastRow!);

    // Data rows - only selected fields
    data.forEach(item => {
      const rowData = fields.map((field: string) => {
        const mapping = fieldMapping[field];
        return mapping ? mapping.extractor(item) : '';
      });
      dataSheet.addRow(rowData);
    });

    // Format columns based on selected fields
    fields.forEach((field: string, index: number) => {
      const mapping = fieldMapping[field];
      if (mapping?.width) {
        dataSheet.getColumn(index + 1).width = mapping.width;
      }
    });

    // Freeze header row
    dataSheet.views = [{ state: 'frozen', ySplit: 6 }];

    // ===== SUMMARY SHEET =====
    const summarySheet = workbook.addWorksheet('Summary');
    this.addTitleSection(summarySheet, branding, 'Export Summary');

    summarySheet.addRow(['Metric', 'Value']);
    this.styleHeaderRow(summarySheet.lastRow!);

    summarySheet.addRow(['Report Type', reportType.charAt(0).toUpperCase() + reportType.slice(1)]);
    summarySheet.addRow(['Total Records', data.length]);
    summarySheet.addRow(['Selected Fields', fields.length]);
    summarySheet.addRow(['Export Date', new Date().toLocaleDateString()]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Selected Fields:']);
    fields.forEach((field: string) => {
      summarySheet.addRow(['', fieldMapping[field]?.header || field]);
    });

    summarySheet.getColumn(1).width = 25;
    summarySheet.getColumn(2).width = 20;

    // Save workbook
    await workbook.xlsx.writeFile(filepath);
  },

  // Helper methods to get data for different report types
  async getTransactionsData(associationId: number) {
    return await prisma.transaction.findMany({
      where: { associationId },
      include: {
        member: { select: { id: true, memberId: true, firstName: true, lastName: true, email: true } },
        category: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });
  },

  async getPaymentsData(associationId: number) {
    return await prisma.payment.findMany({
      where: { associationId },
      include: {
        transaction: {
          include: {
            member: { select: { id: true, memberId: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
      take: 10000,
    });
  },

  async getWelfareData(associationId: number) {
    // Combine welfare contributions and payouts
    const [contributions, payouts] = await Promise.all([
      prisma.welfareContribution.findMany({
        where: { associationId },
        include: {
          member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
          fund: { select: { name: true } },
        },
        take: 5000,
      }),
      prisma.welfarePayoutRequest.findMany({
        where: { associationId },
        include: {
          member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
          fund: { select: { name: true } },
        },
        take: 5000,
      }),
    ]);

    // Transform and combine data
    const welfareData = [
      ...contributions.map(c => ({
        ...c,
        contributionAmount: c.amount,
        payoutAmount: 0,
        date: c.createdAt,
      })),
      ...payouts.map(p => ({
        ...p,
        contributionAmount: 0,
        payoutAmount: p.amount,
        date: p.createdAt,
      })),
    ];

    return welfareData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async getDonationsData(associationId: number) {
    return await prisma.transaction.findMany({
      where: { 
        associationId,
        category: { type: 'donation' }
      },
      include: {
        member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
        category: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });
  },

  async getLeviesData(associationId: number) {
    return await prisma.transaction.findMany({
      where: { 
        associationId,
        category: { type: 'levy' }
      },
      include: {
        member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
        category: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });
  },

  async getPenaltiesData(associationId: number) {
    return await prisma.appliedPenalty.findMany({
      where: { associationId },
      include: {
        member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
        rule: { select: { name: true } },
      },
      orderBy: { appliedDate: 'desc' },
      take: 10000,
    });
  },

  async getAccountingData(associationId: number) {
    return await prisma.accountingEntry.findMany({
      where: { associationId },
      orderBy: { date: 'desc' },
      take: 10000,
    });
  },
};
