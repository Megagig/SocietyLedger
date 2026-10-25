import { client } from '../client';
import { unwrap } from '../envelope';
import type { SavingsDepositStatus, SavingsTransactionsResponseDTO } from '@/types/api/cooperatives';
import type {
  CooperativeDashboardDTO,
  DisbursePayload,
  LoanProductPayload,
  OfficerApplicationDTO,
  OfficerApplicationsDTO,
  OfficerDepositRequestDTO,
  OfficerDepositRequestsDTO,
  OfficerLoanDTO,
  OfficerLoanProductDTO,
  OfficerLoanProductsDTO,
  OfficerLoansDTO,
  OfficerRepaymentRequestDTO,
  OfficerRepaymentRequestsDTO,
  OfficerSavingsAccountDTO,
  OfficerSavingsAccountsDTO,
  OpenAccountPayload,
  RecordLoanRepaymentPayload,
  RecordSavingsPayload,
  ReviewApplicationPayload,
} from '@/types/api/coopManage';
import type { LoanApplicationStatus, LoanRepaymentsResponseDTO, LoanStatus } from '@/types/api/loans';

const BASE = '/cooperatives';
type Page = { page?: number; limit?: number };

/**
 * Cooperatives for officers. Savings accounts and money in/out need `cooperative.savings.manage`; products, applications, loans and
 * repayments need `cooperative.loans.manage`. Every call needs the `cooperatives` module. An officer can't decide a request that is
 * their own (403 `OWN_REQUEST`).
 */
export const coopManageApi = {
  async getDashboard(): Promise<CooperativeDashboardDTO> {
    return unwrap<CooperativeDashboardDTO>(client.get(`${BASE}/dashboard`));
  },

  // ---------------------------------------------------------------- savings
  async listAccounts(params: Page & { search?: string; status?: string; memberId?: number }): Promise<OfficerSavingsAccountsDTO> {
    return unwrap<OfficerSavingsAccountsDTO>(client.get(`${BASE}/savings-accounts`, { params }));
  },

  async getAccount(id: number): Promise<OfficerSavingsAccountDTO> {
    return unwrap<OfficerSavingsAccountDTO>(client.get(`${BASE}/savings-accounts/${id}`));
  },

  async openAccount(payload: OpenAccountPayload): Promise<OfficerSavingsAccountDTO> {
    return unwrap<OfficerSavingsAccountDTO>(client.post(`${BASE}/savings-accounts`, payload));
  },

  async listAccountTransactions(params: Page & { savingsAccountId: number }): Promise<SavingsTransactionsResponseDTO> {
    return unwrap<SavingsTransactionsResponseDTO>(client.get(`${BASE}/savings-transactions`, { params }));
  },

  /** POST …/savings-transactions — a deposit or withdrawal recorded by the officer. 409 `INSUFFICIENT_BALANCE` or `SAVINGS_HELD` for a withdrawal that can't be made. */
  async recordSavings(payload: RecordSavingsPayload): Promise<unknown> {
    return unwrap<unknown>(client.post(`${BASE}/savings-transactions`, payload));
  },

  // ---------------------------------------------------------------- deposit requests
  async listDepositRequests(params: Page & { status?: SavingsDepositStatus }): Promise<OfficerDepositRequestsDTO> {
    return unwrap<OfficerDepositRequestsDTO>(client.get(`${BASE}/savings-deposits`, { params }));
  },

  async approveDeposit(id: number): Promise<OfficerDepositRequestDTO> {
    return unwrap<OfficerDepositRequestDTO>(client.post(`${BASE}/savings-deposits/${id}/approve`, {}));
  },

  async rejectDeposit(id: number, reason: string): Promise<OfficerDepositRequestDTO> {
    return unwrap<OfficerDepositRequestDTO>(client.post(`${BASE}/savings-deposits/${id}/reject`, { reason }));
  },

  // ---------------------------------------------------------------- repayment requests
  async listRepaymentRequests(params: Page & { status?: SavingsDepositStatus }): Promise<OfficerRepaymentRequestsDTO> {
    return unwrap<OfficerRepaymentRequestsDTO>(client.get(`${BASE}/loan-repayment-requests`, { params }));
  },

  async approveRepayment(id: number): Promise<OfficerRepaymentRequestDTO> {
    return unwrap<OfficerRepaymentRequestDTO>(client.post(`${BASE}/loan-repayment-requests/${id}/approve`, {}));
  },

  async rejectRepayment(id: number, reason: string): Promise<OfficerRepaymentRequestDTO> {
    return unwrap<OfficerRepaymentRequestDTO>(client.post(`${BASE}/loan-repayment-requests/${id}/reject`, { reason }));
  },

  // ---------------------------------------------------------------- loan products
  async listProducts(params: Page & { isActive?: boolean }): Promise<OfficerLoanProductsDTO> {
    const query = { ...params, isActive: params.isActive === undefined ? undefined : String(params.isActive) };
    return unwrap<OfficerLoanProductsDTO>(client.get(`${BASE}/loan-products`, { params: query }));
  },

  async createProduct(payload: LoanProductPayload): Promise<OfficerLoanProductDTO> {
    return unwrap<OfficerLoanProductDTO>(client.post(`${BASE}/loan-products`, payload));
  },

  async updateProduct(id: number, payload: Partial<LoanProductPayload>): Promise<OfficerLoanProductDTO> {
    return unwrap<OfficerLoanProductDTO>(client.put(`${BASE}/loan-products/${id}`, payload));
  },

  // ---------------------------------------------------------------- applications
  async listApplications(params: Page & { status?: LoanApplicationStatus; search?: string }): Promise<OfficerApplicationsDTO> {
    return unwrap<OfficerApplicationsDTO>(client.get(`${BASE}/loan-applications`, { params }));
  },

  async getApplication(id: number): Promise<OfficerApplicationDTO> {
    return unwrap<OfficerApplicationDTO>(client.get(`${BASE}/loan-applications/${id}`));
  },

  /** POST …/review — 409 `ALREADY_DECIDED` when someone else decided it first; 403 `OWN_REQUEST` for the officer's own application. */
  async reviewApplication(id: number, payload: ReviewApplicationPayload): Promise<OfficerApplicationDTO> {
    return unwrap<OfficerApplicationDTO>(client.post(`${BASE}/loan-applications/${id}/review`, payload));
  },

  /** POST …/disburse — pays an approved loan out, once. 409 `ALREADY_DISBURSED`; 400 `DISBURSE_ACCOUNT_INVALID` for a savings credit to the wrong account. */
  async disburse(id: number, payload: DisbursePayload): Promise<OfficerLoanDTO> {
    return unwrap<OfficerLoanDTO>(client.post(`${BASE}/loan-applications/${id}/disburse`, payload));
  },

  // ---------------------------------------------------------------- loans
  async listLoans(params: Page & { status?: LoanStatus; search?: string }): Promise<OfficerLoansDTO> {
    return unwrap<OfficerLoansDTO>(client.get(`${BASE}/loans`, { params }));
  },

  async getLoan(id: number): Promise<OfficerLoanDTO> {
    return unwrap<OfficerLoanDTO>(client.get(`${BASE}/loans/${id}`));
  },

  async listLoanRepayments(params: Page & { loanId: number }): Promise<LoanRepaymentsResponseDTO> {
    return unwrap<LoanRepaymentsResponseDTO>(client.get(`${BASE}/loan-repayments`, { params }));
  },

  /** POST …/loan-repayments — an officer records a repayment. 400 `REPAYMENT_TOO_LARGE` when it is more than is still owed. */
  async recordRepayment(payload: RecordLoanRepaymentPayload): Promise<unknown> {
    return unwrap<unknown>(client.post(`${BASE}/loan-repayments`, payload));
  },
};
