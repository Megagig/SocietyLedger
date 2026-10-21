import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  CreateLoanApplicationPayload,
  GuarantorCandidateDTO,
  LoanApplicationDTO,
  LoanApplicationsResponseDTO,
  LoanDTO,
  LoanProductsResponseDTO,
  LoanRepaymentRequestDTO,
  LoanRepaymentRequestsResponseDTO,
  LoanRepaymentsResponseDTO,
  LoansResponseDTO,
  SubmitLoanRepaymentPayload,
} from '@/types/api/loans';

/** Loan side of `/cooperatives/*` — tenant + `cooperatives` module required. Member calls are scoped to the caller's own member server-side. */
export const loansApi = {
  /** GET /cooperatives/loans — includes each loan's repayment schedule. */
  async listLoans(params: { page?: number; limit?: number } = {}): Promise<LoansResponseDTO> {
    return unwrap<LoansResponseDTO>(client.get('/cooperatives/loans', { params: { page: 1, limit: 50, ...params } }));
  },

  /** GET /cooperatives/loans/:id — 404 for another member's loan. */
  async getLoan(id: number): Promise<LoanDTO> {
    return unwrap<LoanDTO>(client.get(`/cooperatives/loans/${id}`));
  },

  /** GET /cooperatives/loan-applications — the caller's own applications. */
  async listApplications(params: { page?: number; limit?: number } = {}): Promise<LoanApplicationsResponseDTO> {
    return unwrap<LoanApplicationsResponseDTO>(client.get('/cooperatives/loan-applications', { params: { page: 1, limit: 50, ...params } }));
  },

  /** POST /cooperatives/loan-applications — the server recalculates repayment figures; the loan exists only after an officer disburses it. */
  async createApplication(payload: CreateLoanApplicationPayload): Promise<LoanApplicationDTO> {
    return unwrap<LoanApplicationDTO>(client.post('/cooperatives/loan-applications', payload));
  },

  /** GET /cooperatives/loan-products?isActive=true */
  async listProducts(): Promise<LoanProductsResponseDTO> {
    return unwrap<LoanProductsResponseDTO>(client.get('/cooperatives/loan-products', { params: { page: 1, limit: 50, isActive: 'true' } }));
  },

  /** GET /cooperatives/guarantor-candidates?search= — up to 20 members, never the applicant. */
  async searchGuarantorCandidates(search: string): Promise<GuarantorCandidateDTO[]> {
    const { members } = await unwrap<{ members: GuarantorCandidateDTO[] }>(
      client.get('/cooperatives/guarantor-candidates', { params: { search: search || undefined } }),
    );
    return members;
  },

  /** GET /cooperatives/loan-repayments — payments an officer has recorded against the caller's loans. */
  async listRepayments(params: { page?: number; limit?: number; loanId?: number } = {}): Promise<LoanRepaymentsResponseDTO> {
    return unwrap<LoanRepaymentsResponseDTO>(client.get('/cooperatives/loan-repayments', { params: { page: 1, limit: 50, ...params } }));
  },

  /** GET /cooperatives/loan-repayment-requests — the caller's receipt-backed payment declarations. */
  async listRepaymentRequests(params: { page?: number; limit?: number; loanId?: number } = {}): Promise<LoanRepaymentRequestsResponseDTO> {
    return unwrap<LoanRepaymentRequestsResponseDTO>(client.get('/cooperatives/loan-repayment-requests', { params: { page: 1, limit: 50, ...params } }));
  },

  /** POST /cooperatives/loan-repayment-requests (multipart) — creates a PENDING request, capped server-side at the outstanding balance. */
  async submitRepaymentRequest(payload: SubmitLoanRepaymentPayload): Promise<LoanRepaymentRequestDTO> {
    const formData = new FormData();
    formData.append('loanId', String(payload.loanId));
    formData.append('amount', payload.amount);
    formData.append('paymentDate', payload.paymentDate);
    if (payload.reference) formData.append('reference', payload.reference);
    if (payload.memberNote) formData.append('memberNote', payload.memberNote);
    formData.append('file', { uri: payload.file.uri, name: payload.file.name, type: payload.file.type } as never);

    return unwrap<LoanRepaymentRequestDTO>(
      client.post('/cooperatives/loan-repayment-requests', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    );
  },

  /** GET /cooperatives/loan-repayment-requests/:id/receipt?format=json */
  async getRepaymentRequestReceiptUrl(id: number): Promise<{ url: string; filename: string }> {
    return unwrap(client.get(`/cooperatives/loan-repayment-requests/${id}/receipt`, { params: { format: 'json' } }));
  },
};
