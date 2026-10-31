/**
 * The request headers a browser is allowed to send to the API from another origin (the web app on a group's own address calling the API).
 *
 * The browser asks first (a "preflight") and refuses to send the real request if it carries a custom header that is not named here, so a payment
 * from the web app can fail before it leaves the browser. Add a header here whenever the web app starts sending a new one.
 *
 * Idempotency-Key: every money write from the web carries one, so sending the same payment twice cannot count it twice.
 */
export const ALLOWED_REQUEST_HEADERS = ['Content-Type', 'Authorization', 'X-Tenant', 'X-Tenant-Id', 'X-Association-Id', 'Idempotency-Key'];
