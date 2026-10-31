/**
 * A browser asks the API first (a preflight) whether it may send a request header, and refuses to send the real request if the answer is no. A
 * header the web app sends but the API does not name makes that whole feature fail in the browser (payments did, on Idempotency-Key). So:
 * the real preflight answers yes to every header the web app sends, and a new header added to the web app without updating the list fails here.
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

  it('names each Idempotency-Key and X-… header used as a request header in apps/web/src', () => {
    const webSrc = path.resolve(__dirname, '../../web/src');
    expect(fs.existsSync(webSrc)).toBe(true);
    const wanted = new Set<string>();
    for (const file of sourceFiles(webSrc)) {
      // not a header sent by the browser: the webhook tester carries these as DATA inside a test payload it asks the server to relay
      if (file.includes(`${path.sep}webhooks${path.sep}`)) continue;
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/['"](Idempotency-Key|X-[A-Za-z][A-Za-z-]*)['"]\s*:/g)) wanted.add(m[1]);
    }
    const allowedLower = ALLOWED_REQUEST_HEADERS.map((h) => h.toLowerCase());
    const missing = [...wanted].filter((h) => !allowedLower.includes(h.toLowerCase()));
    expect(missing).toEqual([]);
    expect(wanted.has('Idempotency-Key')).toBe(true); // the scan really did find the payment header
  });
});
