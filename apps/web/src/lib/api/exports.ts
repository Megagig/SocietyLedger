import api from '../axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface ExportResult {
  id: number;
  filename: string;
  filepath: string;
  format: 'pdf' | 'excel';
  type: string;
  fileSize: number;
  downloadUrl: string;
  expiresAt: string;
}

export interface ExportHistoryItem {
  id: number;
  type: string;
  format: string;
  filename: string;
  fileSize: number;
  downloadUrl: string;
  createdAt: string;
  expiresAt: string;
  createdBy: {
    id: number;
    name: string;
    email: string;
  };
}

export const exportsApi = {
  /**
   * Export financial summary as PDF
   */
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

  /**
   * Export financial summary as Excel
   */
  async exportFinancialExcel(params: {
    period?: string;
    startDate?: string;
    endDate?: string;
    includeComparison?: boolean;
  }) {
    const response = await api.post(`${API_URL}/api/exports/financial-excel`, {
      format: 'excel',
      ...params,
    });
    return response.data;
  },

  /**
   * Export member statement as PDF
   */
  async exportMemberStatementPDF(memberId: number, params?: {
    startDate?: string;
    endDate?: string;
  }) {
    const response = await api.post(`${API_URL}/api/exports/member-statement/${memberId}`, {
      format: 'pdf',
      ...params,
    });
    return response.data;
  },

  /**
   * Export all members as Excel
   */
  async exportAllMembersExcel(params?: {
    status?: 'all' | 'with_balance' | 'overdue';
  }) {
    const response = await api.post(`${API_URL}/api/exports/members-excel`, {
      format: 'excel',
      ...params,
    });
    return response.data;
  },

  /**
   * Get export history
   */
  async getExportHistory(params?: {
    page?: number;
    limit?: number;
    type?: string;
    format?: 'pdf' | 'excel';
  }) {
    const response = await api.get(`${API_URL}/api/exports/history`, { params });
    return response.data;
  },

  /**
   * Download export file
   */
  getDownloadUrl(exportId: number): string {
    return `${API_URL}/api/exports/download/${exportId}`;
  },

  /**
   * Download export file (triggers browser download)
   */
  async downloadExport(exportId: number) {
    const url = this.getDownloadUrl(exportId);
    window.open(url, '_blank');
  },

  /**
   * Delete export file
   */
  async deleteExport(exportId: number) {
    const response = await api.delete(`${API_URL}/api/exports/${exportId}`);
    return response.data;
  },

  /**
   * Re-generate export
   */
  async regenerateExport(exportId: number) {
    const response = await api.post(`${API_URL}/api/exports/${exportId}/regenerate`);
    return response.data;
  },
};
