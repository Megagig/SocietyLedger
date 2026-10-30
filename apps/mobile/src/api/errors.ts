import type { AxiosError } from 'axios';
import { accessCopy, classifyAccessError, moduleDisplayName, type AccessProblemKind } from '@societyledger/shared';

export type ApiFieldError = { path: (string | number)[]; message: string };

export type ApiErrorInit = {
  status: number;
  code?: string;
  message: string;
  fieldErrors?: ApiFieldError[];
  isNetwork?: boolean;
  isTimeout?: boolean;
  accessKind?: AccessProblemKind;
  module?: string;
  serverMessage?: string;
};

type ApiErrorBody = {
  success?: false;
  message?: string;
  code?: string;
  error?: string;
  errors?: { path: (string | number)[]; message: string }[];
  module?: string;
};

/** code-standards.md §10 — every thrown API error is one of these. */
/**
 * A request that asked for raw bytes (a report's PDF or CSV) gets its error back as bytes too. Read them as JSON, so the API's own
 * explanation ("A PDF holds up to 5,000 rows...") reaches the person; anything that is not JSON is left as it was.
 */
export function decodedBody(raw: unknown): unknown {
  if (typeof ArrayBuffer === 'undefined' || !(raw instanceof ArrayBuffer) || typeof TextDecoder === 'undefined') return raw;
  try {
    return JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return raw;
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  fieldErrors?: ApiFieldError[];
  isNetwork: boolean;
  isTimeout: boolean;
  /** Set when the server refused because of who the person is or what their association has paid for: the apps then say so plainly. */
  accessKind?: AccessProblemKind;
  /** The module code the refusal was about (for a plan that does not include it). */
  module?: string;
  /** What the server actually wrote, kept for logs; `message` holds the plain wording for an access problem. */
  serverMessage?: string;

  constructor({ status, code, message, fieldErrors, isNetwork = false, isTimeout = false, accessKind, module, serverMessage }: ApiErrorInit) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.isNetwork = isNetwork;
    this.isTimeout = isTimeout;
    this.accessKind = accessKind;
    this.module = module;
    this.serverMessage = serverMessage;
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

    const { status } = error.response;
    const data = decodedBody(error.response.data) as ApiErrorBody | undefined;
    const fieldErrors = Array.isArray(data?.errors) ? data.errors.map((issue) => ({ path: issue.path, message: issue.message })) : undefined;

    // Module and feature refusals tag themselves in `error` rather than `code`.
    const tag = typeof data?.error === 'string' ? data.error : undefined;
    const accessKind = classifyAccessError({ status, code: data?.code, error: tag, message: data?.message }) ?? undefined;
    const module = typeof data?.module === 'string' ? data.module : undefined;
    // An access problem reads the same everywhere (toasts, error screens), in plain words, not the server's raw sentence.
    const message = accessKind ? accessCopy(accessKind, { moduleName: moduleDisplayName(module) }).short : (data?.message ?? error.message);

    return new ApiError({
      status,
      code: data?.code ?? (accessKind ? tag : undefined),
      message,
      fieldErrors,
      accessKind,
      module,
      serverMessage: data?.message,
    });
  }
}
