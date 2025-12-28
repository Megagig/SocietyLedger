import { Decimal } from '@prisma/client/runtime/library';

// ============================================
// EXPORT TYPES
// ============================================

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

// Member Statement Data
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
