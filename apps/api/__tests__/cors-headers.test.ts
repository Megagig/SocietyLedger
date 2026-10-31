/**
 * A browser asks the API first (a preflight) whether it may send a request header, and refuses to send the real request if the answer is no. A
 * header the web app sends but the API does not name makes that whole feature fail in the browser (payments did, on Idempotency-Key, and the
 * bank-account screen did, on Cache-Control). So: the real preflight answers yes to the payment header, and ANY custom header used anywhere in the
 * web app must be on the API's list or fail here.
 */
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { ALLOWED_REQUEST_HEADERS } from '../src/lib/cors-headers';

const ORIGIN = 'http://opemulero.localhost:3000';

function app() {
  const a = express();
  a.use(cors({ origin: true, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ALLOWED_REQUEST_HEADERS, optionsSuccessStatus: 200 }));
  a.post('/api/ajo/groups/7/contributions/record-received', (_req, res) => res.json({ ok: true }));
  return a;
}

const allowed = (res: request.Response) => (res.headers['access-control-allow-headers'] ?? '').toLowerCase().split(',').map((h: string) => h.trim());

describe('the preflight for a payment from the web app', () => {
  it('allows the Idempotency-Key header a money write carries', async () => {
    const res = await request(app())
      .options('/api/ajo/groups/7/contributions/record-received')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type,idempotency-key,x-tenant');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(allowed(res)).toEqual(expect.arrayContaining(['idempotency-key', 'authorization', 'content-type', 'x-tenant']));
  });

  it('still allows the headers every other web call uses', () => {
    for (const header of ['Content-Type', 'Authorization', 'X-Tenant', 'X-Tenant-Id', 'X-Association-Id']) expect(ALLOWED_REQUEST_HEADERS).toContain(header);
  });
});

describe('every custom header the web app sends is allowed', () => {
  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) sourceFiles(full, out);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  // Headers a browser may always send to another origin without asking. Everything else needs to be on the API's list.
  const ALWAYS_ALLOWED = ['accept', 'accept-language', 'content-language', 'content-type'];
  // Capitalised, hyphenated words that look like headers to the scan but are display labels used as object keys. A NEW name that is not a
  // header and shows up here has to be looked at and added on purpose.
  const NOT_HEADERS = ['add-on', 're-run'];
  const HEADERS_OBJECT_KEY = /['"]([A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+)['"]\s*:/g; // 'Header-Name': value
  const HEADERS_SET_CALL = /\.(?:set|append)\(\s*['"]([A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*)['"]\s*,/g; // headers.set('Header-Name', ...)
  const ROUTE_HANDLER = /(^|\/)route\.ts$/;

  it('allows every custom request header used anywhere in apps/web/src (Cache-Control, Idempotency-Key, X-..., and so on)', () => {
    const webSrc = path.resolve(__dirname, '../../web/src');
    expect(fs.existsSync(webSrc)).toBe(true);
    const found = new Map<string, string>(); // header -> a file that sends it
    for (const file of sourceFiles(webSrc)) {
      const rel = path.relative(webSrc, file).split(path.sep).join('/');
      // Not request headers: the webhook tester carries these as DATA inside a payload it asks the server to relay, and a route handler's
      // headers are the RESPONSE the web server sends back.
      if (rel.startsWith('components/webhooks/') || ROUTE_HANDLER.test(rel)) continue;
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(HEADERS_OBJECT_KEY)) found.set(m[1], rel);
      for (const m of text.matchAll(HEADERS_SET_CALL)) found.set(m[1], rel);
    }
    const allowedLower = ALLOWED_REQUEST_HEADERS.map((h) => h.toLowerCase());
    const refused = [...found.entries()]
      .filter(([h]) => !allowedLower.includes(h.toLowerCase()) && !ALWAYS_ALLOWED.includes(h.toLowerCase()) && !NOT_HEADERS.includes(h.toLowerCase()))
      .map(([h, file]) => `${h}  (sent from ${file})`);
    expect(refused).toEqual([]);
    expect(found.has('Idempotency-Key')).toBe(true); // the scan really does see the payment header
  });
});
