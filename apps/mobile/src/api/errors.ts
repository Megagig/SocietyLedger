import type { AxiosError } from 'axios';

export type ApiFieldError = { path: (string | number)[]; message: string };

export type ApiErrorInit = {
  status: number;
  code?: string;
  message: string;
  fieldErrors?: ApiFieldError[];
  isNetwork?: boolean;
  isTimeout?: boolean;
};

type ApiErrorBody = {
  success?: false;
  message?: string;
  code?: string;
  error?: string;
  errors?: { path: (string | number)[]; message: string }[];
};

/** code-standards.md §10 — every thrown API error is one of these. */
export class ApiError extends Error {
  status: number;
  code?: string;
  fieldErrors?: ApiFieldError[];
  isNetwork: boolean;
  isTimeout: boolean;

  constructor({ status, code, message, fieldErrors, isNetwork = false, isTimeout = false }: ApiErrorInit) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.isNetwork = isNetwork;
    this.isTimeout = isTimeout;
  }

  /** Builds an ApiError from a rejected axios request — network/timeout when there's no response, otherwise the real envelope's `code`/`message`/`errors[]`. Accepts the response body as `unknown` (axios's own error type doesn't know the shape until this cast) rather than requiring every call site to pre-type it. */
  static fromAxiosError(error: AxiosError<unknown>): ApiError {
    if (!error.response) {
      const isTimeout = error.code === 'ECONNABORTED';
      return new ApiError({
        status: 0,
        message: isTimeout ? 'The request took too long. Try again.' : "You're offline. Check your connection.",
        isNetwork: !isTimeout,
        isTimeout,
      });
    }

    const { status, data: rawData } = error.response;
    const data = rawData as ApiErrorBody | undefined;
    const fieldErrors = Array.isArray(data?.errors) ? data.errors.map((issue) => ({ path: issue.path, message: issue.message })) : undefined;

    return new ApiError({
      status,
      code: data?.code,
      message: data?.message ?? error.message,
      fieldErrors,
    });
  }
}
