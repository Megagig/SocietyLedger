# Phase 10: Export System (PDF/Excel) - Implementation Documentation

**Status:** ✅ Fully Implemented  
**Completion Date:** December 28, 2025  
**Implementation Time:** 4-5 days  
**Developer:** AI Assistant (Kiro)  
**Dependencies:** Phase 5 (Reporting System)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [API Endpoints](#api-endpoints)
7. [Export Types](#export-types)
8. [Usage Examples](#usage-examples)
9. [Testing Guide](#testing-guide)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Export System enables users to generate and download professional PDF and Excel reports with association branding. It provides file management, history tracking, and automatic cleanup of expired exports.

### Key Features

- **PDF Generation:** Branded PDFs with association logo, colors, headers, and footers
- **Excel Generation:** Multi-sheet workbooks with formatted data and charts
- **File Management:** Automatic directory creation, unique filenames, file size tracking
- **Export History:** Track all exports with 7-day expiration
- **Download Management:** Secure file downloads with streaming
- **Association Branding:** Custom logos and colors on all exports
- **Multiple Export Types:** Financial summaries, member statements, member lists

### Business Value

- **Professional Reports:** Share branded reports with stakeholders
- **Data Portability:** Export data for external analysis
- **Compliance:** Maintain audit trail of all exports
- **Member Communication:** Generate individual member statements
- **Board Reporting:** Create presentation-ready financial reports

### Libraries Used

- **PDFKit** (`pdfkit`, `@types/pdfkit`) - PDF document generation
- **ExcelJS** (`exceljs`) - Excel workbook creation
- **Node.js fs** - File system operations

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Report Pages with Export Buttons                      │ │
│  │  - Financial Summary (PDF + Excel)                     │ │
│  │  - Member Balances (Excel)                             │ │
│  │  - Member Statement (PDF)                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Client (apps/web/src/lib/api/exports.ts)         │ │
│  │  - Export request functions                            │ │
│  │  - Download trigger                                    │ │
│  │  - Toast notifications                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Express.js)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Routes (apps/api/src/modules/exports/)               │ │
│  │  - exports.routes.ts                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Controllers                                           │ │
│  │  - exports.controller.ts                               │ │
│  │  - Request validation (Zod)                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Main Export Service                                   │ │
│  │  - exports.service.ts                                  │ │
│  │  - File management                                     │ │
│  │  - History tracking                                    │ │
│  └────────────────────────────────────────────────────────┘ │
│           ↓                              ↓                   │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  PDF Service     │         │  Excel Service   │         │
│  │  - pdf.service.ts│         │  - excel.service │         │
│  │  - PDFKit        │         │  - ExcelJS       │         │
│  └──────────────────┘         └──────────────────┘         │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  File System                                           │ │
│  │  - apps/api/exports/ directory                         │ │
│  │  - Generated PDF/Excel files                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Database (Prisma ORM)                                 │ │
│  │  - ExportHistory table                                 │ │
│  │  - Association branding                                │ │
│  │  - Report data queries                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                         │
│  - export_history table                                      │
│  - associations table (branding)                             │
│  - transactions, members, payments (data)                    │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend:**
- Express.js 4.x - Web framework
- PDFKit - PDF generation library
- ExcelJS - Excel workbook creation
- Prisma 5.0 - ORM for database access
- Zod - Schema validation
- TypeScript 5.x - Type safety
- Node.js fs - File system operations

**Frontend:**
- Next.js 14 - React framework
- TanStack Query - Data fetching
- Mantine UI 7.0 - UI components & notifications
- Axios - HTTP client
- TypeScript 5.x - Type safety



---

## Database Schema

### ExportHistory Table

```prisma
model ExportHistory {
  id            Int         @id @default(autoincrement())
  associationId Int         @map("association_id")
  userId        Int         @map("user_id")
  type          String      // financial_summary, member_statement, all_members
  format        String      // pdf, excel
  filename      String      // Unique filename
  filepath      String      // Full path to file
  fileSize      Int         @map("file_size")  // Size in bytes
  expiresAt     DateTime    @map("expires_at") // 7 days from creation
  createdAt     DateTime    @default(now()) @map("created_at")
  
  association   Association @relation(fields: [associationId], references: [id])
  user          User        @relation(fields: [userId], references: [id])

  @@index([associationId, type])
  @@index([expiresAt])
  @@map("export_history")
}
```

### Key Fields

- **type:** Identifies the export type (financial_summary, member_statement, all_members)
- **format:** File format (pdf or excel)
- **filename:** Generated unique filename (e.g., `financial_summary_1_2025-12-28T10-30-00.pdf`)
- **filepath:** Absolute path to the file on disk
- **fileSize:** File size in bytes for tracking
- **expiresAt:** Expiration date (7 days from creation) for automatic cleanup
- **associationId:** Tenant isolation
- **userId:** Track who generated the export

### Relationships

```
Association (1) ──→ (N) ExportHistory
User (1) ──→ (N) ExportHistory
```

---

## Backend Implementation

### File Structure

```
apps/api/src/modules/exports/
├── exports.types.ts          # TypeScript interfaces
├── exports.service.ts        # Main export service
├── pdf.service.ts            # PDF generation
├── excel.service.ts          # Excel generation
├── exports.controller.ts     # Request handlers
├── exports.routes.ts         # Express routes
└── exports.validation.ts     # Zod validation schemas
```

### 1. Type Definitions (exports.types.ts)

```typescript
import { Decimal } from '@prisma/client/runtime/library';

export type ExportFormat = 'pdf' | 'excel';
export type ExportType = 
  | 'financial_summary' 
  | 'member_balances' 
  | 'member_statement' 
  | 'aging_analysis'
  | 'collection_rate'
  | 'category_report'
  | 'all_members';

export interface ExportOptions {
  format: ExportFormat;
  type: ExportType;
  associationId: number;
  userId: number;
  filters?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ExportResult {
  id: number;
  filename: string;
  filepath: string;
  format: ExportFormat;
  type: ExportType;
  fileSize: number;
  downloadUrl: string;
  expiresAt: Date;
}

export interface AssociationBranding {
  name: string;
  logo?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

export interface PDFDocumentOptions {
  title: string;
  subject?: string;
  author?: string;
  keywords?: string;
  branding: AssociationBranding;
  orientation?: 'portrait' | 'landscape';
}

export interface ExcelWorkbookOptions {
  title: string;
  branding: AssociationBranding;
  sheets: ExcelSheetData[];
}

export interface ExcelSheetData {
  name: string;
  headers: string[];
  data: any[][];
  columnWidths?: number[];
  freezeHeader?: boolean;
}

export interface MemberStatementData {
  member: {
    id: number;
    memberNumber: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  summary: {
    totalDues: Decimal;
    totalPaid: Decimal;
    balance: Decimal;
    lastPaymentDate: Date | null;
  };
  transactions: Array<{
    id: number;
    referenceNumber: string;
    categoryName: string;
    categoryType: string;
    amount: Decimal;
    paidAmount: Decimal;
    balance: Decimal;
    status: string;
    dueDate: Date | null;
    createdAt: Date;
    payments: Array<{
      id: number;
      amountPaid: Decimal;
      paymentMethod: string;
      paymentDate: Date;
      referenceNumber: string | null;
    }>;
  }>;
  statementDate: Date;
  periodStart?: Date;
  periodEnd?: Date;
}
```

### 2. Main Export Service (exports.service.ts)

```typescript
import { prisma } from '../../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';
import { pdfService } from './pdf.service';
import { excelService } from './excel.service';

export const exportsService = {
  /**
   * Get association branding information
   */
  async getAssociationBranding(associationId: number): Promise<AssociationBranding> {
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      select: {
        name: true,
        logo: true,
        primaryColor: true,
      },
    });

    if (!association) {
      throw new Error('Association not found');
    }

    return {
      name: association.name,
      logo: association.logo,
      primaryColor: association.primaryColor,
      secondaryColor: null,
      address: null,
      phone: null,
      email: null,
      website: null,
    };
  },

  /**
   * Create export directory if it doesn't exist
   */
  ensureExportDirectory(): string {
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    return exportDir;
  },

  /**
   * Generate unique filename
   */
  generateFilename(type: string, format: string, associationId: number): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${type}_${associationId}_${timestamp}.${format}`;
  },

  /**
   * Save export record to database
   */
  async saveExportRecord(
    associationId: number,
    userId: number,
    type: string,
    format: string,
    filename: string,
    filepath: string,
    fileSize: number
  ): Promise<ExportResult> {
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const exportRecord = await prisma.exportHistory.create({
      data: {
        associationId,
        userId,
        type,
        format,
        filename,
        filepath,
        fileSize,
        expiresAt,
      },
    });

    return {
      id: exportRecord.id,
      filename: exportRecord.filename,
      filepath: exportRecord.filepath,
      format: format as 'pdf' | 'excel',
      type: type as any,
      fileSize: exportRecord.fileSize,
      downloadUrl: `/api/exports/download/${exportRecord.id}`,
      expiresAt: exportRecord.expiresAt,
    };
  },

  /**
   * Get export history for an association
   */
  async getExportHistory(
    associationId: number,
    options: {
      page?: number;
      limit?: number;
      type?: string;
      format?: string;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = { associationId };
    if (options.type) whereClause.type = options.type;
    if (options.format) whereClause.format = options.format;

    const [exports, totalCount] = await Promise.all([
      prisma.exportHistory.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              member: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.exportHistory.count({ where: whereClause }),
    ]);

    return {
      exports: exports.map(exp => ({
        id: exp.id,
        type: exp.type,
        format: exp.format,
        filename: exp.filename,
        fileSize: exp.fileSize,
        downloadUrl: `/api/exports/download/${exp.id}`,
        createdAt: exp.createdAt,
        expiresAt: exp.expiresAt,
        createdBy: {
          id: exp.user.id,
          name: exp.user.member 
            ? `${exp.user.member.firstName} ${exp.user.member.lastName}`
            : exp.user.email,
          email: exp.user.email,
        },
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + exports.length < totalCount,
      },
    };
  },

  /**
   * Get export by ID
   */
  async getExportById(exportId: number, associationId: number) {
    const exportRecord = await prisma.exportHistory.findFirst({
      where: {
        id: exportId,
        associationId,
      },
    });

    if (!exportRecord) {
      throw new Error('Export not found');
    }

    // Check if expired
    if (new Date() > exportRecord.expiresAt) {
      throw new Error('Export has expired');
    }

    // Check if file exists
    if (!fs.existsSync(exportRecord.filepath)) {
      throw new Error('Export file not found');
    }

    return exportRecord;
  },

  /**
   * Delete expired exports (cleanup job)
   */
  async deleteExpiredExports(): Promise<number> {
    const expiredExports = await prisma.exportHistory.findMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    let deletedCount = 0;

    for (const exp of expiredExports) {
      try {
        // Delete file
        if (fs.existsSync(exp.filepath)) {
          fs.unlinkSync(exp.filepath);
        }

        // Delete record
        await prisma.exportHistory.delete({
          where: { id: exp.id },
        });

        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete export ${exp.id}:`, error);
      }
    }

    return deletedCount;
  },

  /**
   * Export financial summary as PDF
   */
  async exportFinancialSummaryPDF(
    associationId: number,
    userId: number,
    filters: any
  ): Promise<ExportResult> {
    const branding = await this.getAssociationBranding(associationId);
    const exportDir = this.ensureExportDirectory();
    const filename = this.generateFilename('financial_summary', 'pdf', associationId);
    const filepath = path.join(exportDir, filename);

    await pdfService.generateFinancialSummaryPDF(associationId, branding, filters, filepath);

    const stats = fs.statSync(filepath);
    return this.saveExportRecord(
      associationId,
      userId,
      'financial_summary',
      'pdf',
      filename,
      filepath,
      stats.size
    );
  },

  /**
   * Export financial summary as Excel
   */
  async exportFinancialSummaryExcel(
    associationId: number,
    userId: number,
    filters: any
  ): Promise<ExportResult> {
    const branding = await this.getAssociationBranding(associationId);
    const exportDir = this.ensureExportDirectory();
    const filename = this.generateFilename('financial_summary', 'xlsx', associationId);
    const filepath = path.join(exportDir, filename);

    await excelService.generateFinancialSummaryExcel(associationId, branding, filters, filepath);

    const stats = fs.statSync(filepath);
    return this.saveExportRecord(
      associationId,
      userId,
      'financial_summary',
      'excel',
      filename,
      filepath,
      stats.size
    );
  },

  // ... other export methods
};
```



### 3. PDF Service (pdf.service.ts)

The PDF service uses PDFKit to generate professional branded PDF documents.

**Key Features:**
- Association branding (logo, colors)
- Professional headers and footers
- Table generation with pagination
- Currency formatting
- Date formatting
- Automatic page breaks

**Example PDF Generation:**
```typescript
import PDFDocument from 'pdfkit';
import * as fs from 'fs';

export const pdfService = {
  formatCurrency(amount: Decimal | number): string {
    const value = typeof amount === 'number' ? amount : amount.toNumber();
    return `₦${value.toLocaleString('en-NG', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  },

  addHeader(doc: PDFKit.PDFDocument, branding: AssociationBranding, title: string) {
    const primaryColor = branding.primaryColor || '#1e40af';

    // Header background
    doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);

    // Association name
    doc.fillColor('#ffffff')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(branding.name, 50, 25);

    // Document title
    doc.fontSize(12)
      .font('Helvetica')
      .text(title, 50, 50);

    doc.fillColor('#000000');
    doc.moveDown(3);
  },

  addTable(
    doc: PDFKit.PDFDocument,
    headers: string[],
    rows: string[][],
    columnWidths: number[],
    startY: number
  ): number {
    // Table implementation with headers, rows, and pagination
    // Returns the Y position after the table
  },

  async generateFinancialSummaryPDF(
    associationId: number,
    branding: AssociationBranding,
    filters: any,
    filepath: string
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const report = await reportsService.generateFinancialSummary(
          associationId,
          filters,
          true
        );

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Add header
        this.addHeader(doc, branding, 'Financial Summary Report');

        // Add content (summary boxes, tables, charts)
        // ...

        // Add footer
        this.addFooter(doc, branding, 1);

        doc.end();

        stream.on('finish', () => resolve());
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  },
};
```

### 4. Excel Service (excel.service.ts)

The Excel service uses ExcelJS to create multi-sheet workbooks with formatted data.

**Key Features:**
- Multiple worksheets
- Styled headers with colors
- Currency formatting (₦ NGN)
- Column width auto-sizing
- Frozen header rows
- Summary and detail sheets

**Example Excel Generation:**
```typescript
import ExcelJS from 'exceljs';

export const excelService = {
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

  addTitleSection(
    worksheet: ExcelJS.Worksheet,
    branding: AssociationBranding,
    title: string,
    subtitle?: string
  ) {
    // Association name
    const titleRow = worksheet.addRow([branding.name]);
    titleRow.font = { size: 18, bold: true, color: { argb: 'FF1e40af' } };

    // Report title
    const reportTitleRow = worksheet.addRow([title]);
    reportTitleRow.font = { size: 14, bold: true };

    // Generated date
    const dateRow = worksheet.addRow([
      `Generated on: ${new Date().toLocaleString('en-NG')}`
    ]);
    dateRow.font = { size: 10, color: { argb: 'FF666666' } };

    worksheet.addRow([]);
  },

  async generateFinancialSummaryExcel(
    associationId: number,
    branding: AssociationBranding,
    filters: any,
    filepath: string
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const report = await reportsService.generateFinancialSummary(
      associationId, 
      filters, 
      true
    );

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    this.addTitleSection(summarySheet, branding, 'Financial Summary Report');

    summarySheet.addRow(['Metric', 'Amount']);
    this.styleHeaderRow(summarySheet.lastRow!);

    summarySheet.addRow(['Total Income', report.income.total.toNumber()]);
    summarySheet.addRow(['Total Expenses', report.expenses.total.toNumber()]);
    
    // Format currency columns
    summarySheet.getColumn(2).numFmt = '₦#,##0.00';

    // Income by Category Sheet
    const incomeSheet = workbook.addWorksheet('Income by Category');
    // ... add data

    // Save workbook
    await workbook.xlsx.writeFile(filepath);
  },
};
```

---

## API Endpoints

### 1. Export Financial Summary as PDF

**Endpoint:** `POST /api/exports/financial-pdf`

**Request Body:**
```json
{
  "format": "pdf",
  "period": "this_month",
  "startDate": "2025-12-01",
  "endDate": "2025-12-31",
  "includeComparison": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Financial summary PDF generated successfully",
  "data": {
    "id": 1,
    "filename": "financial_summary_1_2025-12-28T10-30-00.pdf",
    "filepath": "/path/to/exports/financial_summary_1_2025-12-28T10-30-00.pdf",
    "format": "pdf",
    "type": "financial_summary",
    "fileSize": 245678,
    "downloadUrl": "/api/exports/download/1",
    "expiresAt": "2026-01-04T10:30:00.000Z"
  }
}
```

### 2. Export Financial Summary as Excel

**Endpoint:** `POST /api/exports/financial-excel`

**Request Body:**
```json
{
  "format": "excel",
  "period": "this_year"
}
```

**Response:** Same structure as PDF export

### 3. Export Member Statement as PDF

**Endpoint:** `POST /api/exports/member-statement/:memberId`

**Request Body:**
```json
{
  "format": "pdf",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31"
}
```

**Response:** Same structure as above

### 4. Export All Members as Excel

**Endpoint:** `POST /api/exports/members-excel`

**Request Body:**
```json
{
  "format": "excel",
  "status": "with_balance"
}
```

**Response:** Same structure as above

### 5. Get Export History

**Endpoint:** `GET /api/exports/history`

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `type` (optional): Filter by export type
- `format` (optional): Filter by format (pdf/excel)

**Response:**
```json
{
  "success": true,
  "data": {
    "exports": [
      {
        "id": 1,
        "type": "financial_summary",
        "format": "pdf",
        "filename": "financial_summary_1_2025-12-28T10-30-00.pdf",
        "fileSize": 245678,
        "downloadUrl": "/api/exports/download/1",
        "createdAt": "2025-12-28T10:30:00.000Z",
        "expiresAt": "2026-01-04T10:30:00.000Z",
        "createdBy": {
          "id": 1,
          "name": "John Doe",
          "email": "john@example.com"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalCount": 45,
      "totalPages": 3,
      "hasMore": true
    }
  }
}
```

### 6. Download Export File

**Endpoint:** `GET /api/exports/download/:id`

**Response:** File stream with appropriate headers
```
Content-Type: application/pdf (or application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
Content-Disposition: attachment; filename="financial_summary_1_2025-12-28T10-30-00.pdf"
Content-Length: 245678
```

---

## Frontend Implementation

### API Client (exports.ts)

```typescript
import api from '../axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const exportsApi = {
  async exportFinancialPDF(params: {
    period?: string;
    startDate?: string;
    endDate?: string;
    includeComparison?: boolean;
  }) {
    const response = await api.post(`${API_URL}/api/exports/financial-pdf`, {
      format: 'pdf',
      ...params,
    });
    return response.data;
  },

  async exportFinancialExcel(params: {
    period?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const response = await api.post(`${API_URL}/api/exports/financial-excel`, {
      format: 'excel',
      ...params,
    });
    return response.data;
  },

  async exportMemberStatementPDF(memberId: number, params?: {
    startDate?: string;
    endDate?: string;
  }) {
    const response = await api.post(
      `${API_URL}/api/exports/member-statement/${memberId}`,
      { format: 'pdf', ...params }
    );
    return response.data;
  },

  async exportAllMembersExcel(params?: {
    status?: 'all' | 'with_balance' | 'overdue';
  }) {
    const response = await api.post(`${API_URL}/api/exports/members-excel`, {
      format: 'excel',
      ...params,
    });
    return response.data;
  },

  async getExportHistory(params?: {
    page?: number;
    limit?: number;
    type?: string;
    format?: 'pdf' | 'excel';
  }) {
    const response = await api.get(`${API_URL}/api/exports/history`, { params });
    return response.data;
  },

  getDownloadUrl(exportId: number): string {
    return `${API_URL}/api/exports/download/${exportId}`;
  },

  async downloadExport(exportId: number) {
    const url = this.getDownloadUrl(exportId);
    window.open(url, '_blank');
  },
};
```

### Export Buttons in Report Pages

```typescript
'use client';

import { useState } from 'react';
import { Button, Group } from '@mantine/core';
import { IconFileTypePdf, IconFileSpreadsheet } from '@tabler/icons-react';
import { exportsApi } from '@/lib/api/exports';
import { notifications } from '@mantine/notifications';

export function FinancialSummaryPage() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const result = await exportsApi.exportFinancialPDF({
        period: 'this_month',
        includeComparison: true,
      });

      if (result.success) {
        notifications.show({
          title: 'Export Successful',
          message: 'Your PDF is ready for download',
          color: 'green',
        });
        exportsApi.downloadExport(result.data.id);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Export Failed',
        message: error.response?.data?.message || 'Failed to generate PDF',
        color: 'red',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    // Similar implementation
  };

  return (
    <div>
      <Group gap="sm">
        <Button
          leftSection={<IconFileTypePdf size={16} />}
          variant="light"
          color="red"
          onClick={handleExportPDF}
          loading={isExporting}
        >
          Export PDF
        </Button>
        <Button
          leftSection={<IconFileSpreadsheet size={16} />}
          variant="light"
          color="green"
          onClick={handleExportExcel}
          loading={isExporting}
        >
          Export Excel
        </Button>
      </Group>

      {/* Report content */}
    </div>
  );
}
```

---

## Export Types

### 1. Financial Summary (PDF & Excel)

**Content:**
- Period information
- Income summary with category breakdown
- Expense summary with category breakdown
- Collections overview (expected, collected, outstanding, rate)
- Period comparison (if requested)
- Charts and visualizations

**Use Cases:**
- Board meetings
- Stakeholder reports
- Financial reviews
- Audit documentation

### 2. Member Statement (PDF)

**Content:**
- Member information (name, ID, contact)
- Account summary (total dues, paid, balance)
- Transaction history with payments
- Statement date and period

**Use Cases:**
- Member communication
- Payment follow-up
- Dispute resolution
- Record keeping

### 3. All Members (Excel)

**Content:**
- Member list with balances
- Total dues, paid, outstanding per member
- Pending and overdue transaction counts
- Last payment date
- Summary statistics

**Use Cases:**
- Collection planning
- Member analysis
- Data export for external tools
- Bulk communication planning

---

## Security & Permissions

### Authentication & Authorization

All export endpoints require:
1. **Authentication:** Valid JWT token
2. **Permission:** `report:view` for financial exports, `member:view` for member exports
3. **Tenant Isolation:** Users can only export data from their association

### File Security

- **Expiration:** Files automatically expire after 7 days
- **Access Control:** Download endpoint validates association ownership
- **File Storage:** Files stored outside web root
- **Cleanup:** Automated cleanup job removes expired files

### Implementation

```typescript
// Route protection
router.post(
  '/financial-pdf',
  authMiddleware,
  requirePermission('report:view'),
  exportsController.exportFinancialPDF
);

// Download validation
async downloadExport(req: Request, res: Response) {
  const associationId = req.user!.associationId!;
  const exportId = parseInt(req.params.id);

  const exportRecord = await exportsService.getExportById(exportId, associationId);
  
  // Validates:
  // - Export exists
  // - Belongs to user's association
  // - Not expired
  // - File exists on disk
  
  // Stream file to response
  const fileStream = fs.createReadStream(exportRecord.filepath);
  fileStream.pipe(res);
}
```

---

## Troubleshooting

### Common Issues

**1. PDF Generation Fails**
- Check PDFKit installation: `npm list pdfkit`
- Verify @types/pdfkit is installed
- Check file permissions on exports directory
- Verify association branding data exists

**2. Excel File Corrupted**
- Ensure ExcelJS version compatibility
- Check for null/undefined values in data
- Verify Decimal to number conversions
- Test with smaller datasets first

**3. File Not Found on Download**
- Check exports directory exists
- Verify file path in database matches actual file
- Check file permissions
- Ensure cleanup job hasn't deleted file prematurely

**4. Memory Issues with Large Exports**
- Use streaming for file downloads
- Process data in batches
- Limit transaction history in member statements
- Consider pagination for large member lists

**5. Slow Export Generation**
- Optimize database queries
- Add indexes on frequently queried fields
- Cache association branding
- Consider background job processing for large exports

---

## Best Practices

1. **Always stream file downloads** - Don't load entire file into memory
2. **Validate file existence before download** - Check file exists on disk
3. **Implement proper cleanup** - Run scheduled job to delete expired exports
4. **Use Decimal for currency** - Never use JavaScript numbers for money
5. **Add file size limits** - Prevent generation of extremely large files
6. **Log export activity** - Track who exports what and when
7. **Test with real data** - Use production-like datasets for testing
8. **Handle errors gracefully** - Return user-friendly error messages
9. **Implement rate limiting** - Prevent abuse of export endpoints
10. **Monitor disk space** - Track exports directory size

---

## Future Enhancements

- **Email Delivery:** Send exports via email instead of download
- **Scheduled Exports:** Automatically generate and email reports on schedule
- **Custom Templates:** Allow users to customize export templates
- **Watermarking:** Add watermarks to trial account exports
- **Compression:** Compress large exports before download
- **Cloud Storage:** Store exports in S3/Cloud Storage instead of local disk
- **Export Queue:** Background job processing for large exports
- **Export Analytics:** Track export usage and popular report types
- **Batch Exports:** Generate multiple exports in one request
- **Export API:** Provide REST API for programmatic export access

---

**Document Version:** 1.0  
**Last Updated:** December 28, 2025  
**Maintained By:** Development Team
