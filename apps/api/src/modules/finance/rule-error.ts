/**
 * A rule an officer's request broke (wrong state, nothing to do, over a limit). It carries the HTTP status and a stable `code` the
 * apps can react to, so the controller answers with the real status and a plain-words message instead of a blanket 500.
 */
export class RuleError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409,
    readonly code: string,
  ) {
    super(message);
  }
}
