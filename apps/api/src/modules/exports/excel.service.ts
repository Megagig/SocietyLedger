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
};
