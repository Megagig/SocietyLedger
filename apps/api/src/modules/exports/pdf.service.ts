import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import { Decimal } from '@prisma/client/runtime/library';
import { AssociationBranding, MemberStatementData, LedgerStatementData } from './exports.types';
import { reportsService } from '../reports/reports.service';

// ============================================
// PDF SERVICE
// ============================================

export const pdfService = {
  /**
   * Format currency
   */
  formatCurrency(amount: Decimal | number): string {
    const value = typeof amount === 'number' ? amount : amount.toNumber();
    // Use NGN instead of ₦ symbol for better PDF compatibility
    return `NGN ${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  /**
   * Format date
   */
  formatDate(date: Date | null | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  },

  /**
   * Add header to PDF
   */
  addHeader(doc: PDFKit.PDFDocument, branding: AssociationBranding, title: string) {
    const primaryColor = branding.primaryColor || '#1e40af';

    // Header background
    doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);

    // Association name
    doc.fillColor('#ffffff')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(branding.name, 50, 25, { width: doc.page.width - 100 });

    // Document title
    doc.fontSize(12)
      .font('Helvetica')
      .text(title, 50, 50);

    // Reset color
    doc.fillColor('#000000');

    // Move cursor down
    doc.moveDown(3);
  },

  /**
   * Add footer to PDF
   */
  addFooter(doc: PDFKit.PDFDocument, branding: AssociationBranding, pageNumber: number) {
    const bottomY = doc.page.height - 50;

    doc.fontSize(8)
      .fillColor('#666666')
      .text(
        `Generated on ${this.formatDate(new Date())} | Page ${pageNumber}`,
        50,
        bottomY,
        { align: 'center', width: doc.page.width - 100 }
      );

    if (branding.email || branding.phone) {
      doc.text(
        `${branding.email || ''} ${branding.phone ? '| ' + branding.phone : ''}`,
        50,
        bottomY + 12,
        { align: 'center', width: doc.page.width - 100 }
      );
    }

    doc.fillColor('#000000');
  },

  /**
   * Add table to PDF
   */
  addTable(
    doc: PDFKit.PDFDocument,
    headers: string[],
    rows: string[][],
    columnWidths: number[],
    startY: number
  ): number {
    const tableTop = startY;
    const rowHeight = 25;
    let currentY = tableTop;

    // Draw header
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e40af');
    let currentX = 50;
    headers.forEach((header, i) => {
      doc.text(header, currentX, currentY, {
        width: columnWidths[i],
        align: 'left',
      });
      currentX += columnWidths[i];
    });

    currentY += rowHeight;

    // Draw header line
    doc.moveTo(50, currentY).lineTo(doc.page.width - 50, currentY).stroke('#cccccc');
    currentY += 5;

    // Draw rows
    doc.fontSize(9).font('Helvetica').fillColor('#000000');
    rows.forEach((row, rowIndex) => {
      // Check if we need a new page
      if (currentY > doc.page.height - 100) {
        doc.addPage();
        currentY = 50;
      }

      currentX = 50;
      row.forEach((cell, i) => {
        doc.text(cell, currentX, currentY, {
          width: columnWidths[i],
          align: i === 0 ? 'left' : 'right',
        });
        currentX += columnWidths[i];
      });

      currentY += rowHeight;

      // Draw row line
      if (rowIndex < rows.length - 1) {
        doc.moveTo(50, currentY).lineTo(doc.page.width - 50, currentY).stroke('#eeeeee');
        currentY += 5;
      }
    });

    return currentY;
  },

  /**
   * Generate Financial Summary PDF
   */
  async generateFinancialSummaryPDF(
    associationId: number,
    branding: AssociationBranding,
    filters: any,
    filepath: string
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Get report data
        const report = await reportsService.generateFinancialSummary(
          associationId,
          filters,
          true // include comparison
        );

        // Create PDF document
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Add header
        this.addHeader(doc, branding, 'Financial Summary Report');

        // Period information
        doc.fontSize(12)
          .font('Helvetica-Bold')
          .text(`Period: ${report.period.label}`, 50, 100);

        doc.fontSize(10)
          .font('Helvetica')
          .text(
            `${this.formatDate(report.period.startDate)} - ${this.formatDate(report.period.endDate)}`,
            50,
            115
          );

        doc.moveDown(2);

        // Summary boxes
        let currentY = 150;
        const boxWidth = (doc.page.width - 150) / 3;
        const boxHeight = 80;

        // Income box
        doc.rect(50, currentY, boxWidth, boxHeight).fillAndStroke('#e0f2fe', '#0284c7');
        doc.fillColor('#000000')
          .fontSize(10)
          .text('Total Income', 60, currentY + 15);
        doc.fontSize(16)
          .font('Helvetica-Bold')
          .text(this.formatCurrency(report.income.total), 60, currentY + 35);

        // Expenses box
        doc.rect(50 + boxWidth + 25, currentY, boxWidth, boxHeight).fillAndStroke('#fee2e2', '#dc2626');
        doc.fillColor('#000000')
          .fontSize(10)
          .font('Helvetica')
          .text('Total Expenses', 60 + boxWidth + 25, currentY + 15);
        doc.fontSize(16)
          .font('Helvetica-Bold')
          .text(this.formatCurrency(report.expenses.total), 60 + boxWidth + 25, currentY + 35);

        // Collection Rate box
        doc.rect(50 + (boxWidth + 25) * 2, currentY, boxWidth, boxHeight)
          .fillAndStroke('#dcfce7', '#16a34a');
        doc.fillColor('#000000')
          .fontSize(10)
          .font('Helvetica')
          .text('Collection Rate', 60 + (boxWidth + 25) * 2, currentY + 15);
        doc.fontSize(16)
          .font('Helvetica-Bold')
          .text(
            `${report.collections.collectionRate.toFixed(1)}%`,
            60 + (boxWidth + 25) * 2,
            currentY + 35
          );

        currentY += boxHeight + 30;

        // Collections details
        doc.fontSize(12)
          .font('Helvetica-Bold')
          .text('Collections Overview', 50, currentY);

        currentY += 25;

        const collectionRows = [
          ['Expected', this.formatCurrency(report.collections.expected)],
          ['Collected', this.formatCurrency(report.collections.collected)],
          ['Outstanding', this.formatCurrency(report.collections.outstanding)],
        ];

        currentY = this.addTable(
          doc,
          ['Description', 'Amount'],
          collectionRows,
          [300, 200],
          currentY
        );

        currentY += 30;

        // Income by category
        if (report.income.byCategory.length > 0) {
          doc.fontSize(12)
            .font('Helvetica-Bold')
            .text('Income by Category', 50, currentY);

          currentY += 25;

          const incomeRows = report.income.byCategory.map(cat => [
            cat.categoryName,
            cat.transactionCount.toString(),
            this.formatCurrency(cat.amount),
          ]);

          currentY = this.addTable(
            doc,
            ['Category', 'Count', 'Amount'],
            incomeRows,
            [250, 100, 150],
            currentY
          );

          currentY += 30;
        }

        // Comparison (if available)
        if (report.comparison) {
          doc.addPage();
          currentY = 50;

          doc.fontSize(14)
            .font('Helvetica-Bold')
            .text('Period Comparison', 50, currentY);

          currentY += 30;

          const comparisonRows = [
            [
              'Income',
              this.formatCurrency(report.comparison.previousPeriod.income),
              this.formatCurrency(report.income.total),
              `${report.comparison.changes.income.percentage >= 0 ? '+' : ''}${report.comparison.changes.income.percentage.toFixed(1)}%`,
            ],
            [
              'Expenses',
              this.formatCurrency(report.comparison.previousPeriod.expenses),
              this.formatCurrency(report.expenses.total),
              `${report.comparison.changes.expenses.percentage >= 0 ? '+' : ''}${report.comparison.changes.expenses.percentage.toFixed(1)}%`,
            ],
            [
              'Collections',
              this.formatCurrency(report.comparison.previousPeriod.collections),
              this.formatCurrency(report.collections.collected),
              `${report.comparison.changes.collections.percentage >= 0 ? '+' : ''}${report.comparison.changes.collections.percentage.toFixed(1)}%`,
            ],
          ];

          this.addTable(
            doc,
            ['Metric', 'Previous Period', 'Current Period', 'Change'],
            comparisonRows,
            [150, 120, 120, 110],
            currentY
          );
        }

        // Add footer
        this.addFooter(doc, branding, 1);

        // Finalize PDF
        doc.end();

        stream.on('finish', () => resolve());
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Generate Member Statement PDF
   */
  async generateMemberStatementPDF(
    statementData: MemberStatementData,
    branding: AssociationBranding,
    filepath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Add header
        this.addHeader(doc, branding, 'Member Statement');

        // Member information
        let currentY = 100;

        doc.fontSize(14)
          .font('Helvetica-Bold')
          .text('Member Information', 50, currentY);

        currentY += 25;

        doc.fontSize(10).font('Helvetica');
        doc.text(`Member ID: ${statementData.member.memberNumber}`, 50, currentY);
        currentY += 15;
        doc.text(
          `Name: ${statementData.member.firstName} ${statementData.member.lastName}`,
          50,
          currentY
        );
        currentY += 15;
        if (statementData.member.email) {
          doc.text(`Email: ${statementData.member.email}`, 50, currentY);
          currentY += 15;
        }
        if (statementData.member.phone) {
          doc.text(`Phone: ${statementData.member.phone}`, 50, currentY);
          currentY += 15;
        }

        currentY += 20;

        // Statement period
        doc.fontSize(10)
          .font('Helvetica')
          .text(`Statement Date: ${this.formatDate(statementData.statementDate)}`, 50, currentY);

        if (statementData.periodStart && statementData.periodEnd) {
          currentY += 15;
          doc.text(
            `Period: ${this.formatDate(statementData.periodStart)} - ${this.formatDate(statementData.periodEnd)}`,
            50,
            currentY
          );
        }

        currentY += 30;

        // Summary
        doc.fontSize(14)
          .font('Helvetica-Bold')
          .text('Account Summary', 50, currentY);

        currentY += 25;

        const summaryRows = [
          ['Total Dues', this.formatCurrency(statementData.summary.totalDues)],
          ['Total Paid', this.formatCurrency(statementData.summary.totalPaid)],
          ['Balance', this.formatCurrency(statementData.summary.balance)],
          [
            'Last Payment',
            statementData.summary.lastPaymentDate
              ? this.formatDate(statementData.summary.lastPaymentDate)
              : 'No payments',
          ],
        ];

        currentY = this.addTable(doc, ['Description', 'Amount'], summaryRows, [300, 200], currentY);

        currentY += 30;

        // Transactions
        if (statementData.transactions.length > 0) {
          doc.fontSize(14)
            .font('Helvetica-Bold')
            .text('Transaction History', 50, currentY);

          currentY += 25;

          const transactionRows = statementData.transactions.map(txn => [
            this.formatDate(txn.createdAt),
            txn.categoryName,
            this.formatCurrency(txn.amount),
            this.formatCurrency(txn.paidAmount),
            this.formatCurrency(txn.balance),
            txn.status.toUpperCase(),
          ]);

          this.addTable(
            doc,
            ['Date', 'Category', 'Amount', 'Paid', 'Balance', 'Status'],
            transactionRows,
            [80, 100, 80, 80, 80, 75],
            currentY
          );
        }

        // Add footer
        this.addFooter(doc, branding, 1);

        // Finalize PDF
        doc.end();

        stream.on('finish', () => resolve());
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Generate Member Ledger Statement PDF
   * Complete financial history with opening/closing balance
   */
  async generateLedgerStatementPDF(
    statementData: LedgerStatementData,
    branding: AssociationBranding,
    filepath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Add header
        this.addHeader(doc, branding, 'Member Financial Ledger Statement');

        // Member information
        let currentY = 100;

        doc.fontSize(14)
          .font('Helvetica-Bold')
          .text('Member Information', 50, currentY);

        currentY += 25;

        doc.fontSize(10).font('Helvetica');
        doc.text(`Member ID: ${statementData.member.memberId}`, 50, currentY);
        currentY += 15;
        doc.text(
          `Name: ${statementData.member.firstName} ${statementData.member.lastName}`,
          50,
          currentY
        );
        currentY += 15;
        if (statementData.member.email) {
          doc.text(`Email: ${statementData.member.email}`, 50, currentY);
          currentY += 15;
        }

        currentY += 20;

        // Statement period
        doc.fontSize(12)
          .font('Helvetica-Bold')
          .text('Statement Period', 50, currentY);

        currentY += 20;

        doc.fontSize(10).font('Helvetica');
        doc.text(
          `From: ${this.formatDate(statementData.period.startDate)}  To: ${this.formatDate(statementData.period.endDate)}`,
          50,
          currentY
        );

        currentY += 30;

        // Opening Balance
        doc.fontSize(12)
          .font('Helvetica-Bold')
          .fillColor('#1e40af')
          .text('Opening Balance:', 50, currentY);
        doc.text(this.formatCurrency(statementData.openingBalance), 200, currentY);
        doc.fillColor('#000000');

        currentY += 30;

        // Ledger entries table
        if (statementData.entries.length > 0) {
          doc.fontSize(12)
            .font('Helvetica-Bold')
            .text('Transaction Details', 50, currentY);

          currentY += 25;

          const entryRows = statementData.entries.map(entry => [
            this.formatDate(entry.date),
            entry.description.substring(0, 30) + (entry.description.length > 30 ? '...' : ''),
            entry.debit > 0 ? this.formatCurrency(entry.debit) : '-',
            entry.credit > 0 ? this.formatCurrency(entry.credit) : '-',
            this.formatCurrency(entry.balance),
          ]);

          currentY = this.addTable(
            doc,
            ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
            entryRows,
            [70, 180, 80, 80, 85],
            currentY
          );
        } else {
          doc.fontSize(10)
            .font('Helvetica')
            .text('No transactions in this period.', 50, currentY);
          currentY += 20;
        }

        currentY += 30;

        // Totals
        doc.fontSize(12)
          .font('Helvetica-Bold')
          .text('Summary', 50, currentY);

        currentY += 25;

        const summaryRows = [
          ['Total Debits (Charges)', this.formatCurrency(statementData.totals.totalDebits)],
          ['Total Credits (Payments)', this.formatCurrency(statementData.totals.totalCredits)],
        ];

        currentY = this.addTable(doc, ['Description', 'Amount'], summaryRows, [300, 195], currentY);

        currentY += 20;

        // Closing Balance
        const closingBalanceColor = statementData.closingBalance > 0 ? '#dc2626' : '#16a34a';
        doc.fontSize(14)
          .font('Helvetica-Bold')
          .fillColor(closingBalanceColor)
          .text('Closing Balance:', 50, currentY);
        doc.text(this.formatCurrency(statementData.closingBalance), 200, currentY);
        doc.fillColor('#000000');

        currentY += 20;

        // Balance status
        if (statementData.closingBalance > 0) {
          doc.fontSize(10)
            .font('Helvetica')
            .fillColor('#dc2626')
            .text('(Amount Outstanding)', 50, currentY);
        } else if (statementData.closingBalance < 0) {
          doc.fontSize(10)
            .font('Helvetica')
            .fillColor('#16a34a')
            .text('(Credit Balance)', 50, currentY);
        } else {
          doc.fontSize(10)
            .font('Helvetica')
            .fillColor('#16a34a')
            .text('(Account Settled)', 50, currentY);
        }
        doc.fillColor('#000000');

        // Add footer
        this.addFooter(doc, branding, 1);

        // Finalize PDF
        doc.end();

        stream.on('finish', () => resolve());
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  },
};
