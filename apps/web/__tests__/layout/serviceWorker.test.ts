/**
 * The real public/sw.js, run in a sandbox. Its "show the saved copy, refresh in the background" path used to answer with nothing when there was no
 * saved copy and the network failed (an aborted prefetch, going offline), and the browser threw "Failed to convert value to 'Response'".
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const source = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');

type FetchHandler = (event: { request: unknown; respondWith: (p: Promise<Response> | Response | undefined) => void }) => void;

function loadWorker(world: { saved?: Response; network: () => Promise<Response> }) {
  const handlers: Record<string, FetchHandler> = {};
  const store = new Map<string, Response>();
  const cache = { match: async () => world.saved, put: async (_k: unknown, v: Response) => { store.set('x', v); }, addAll: async () => undefined };
  const sandbox = {
    self: { addEventListener: (name: string, fn: FetchHandler) => { handlers[name] = fn; }, skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve() }, location: { origin: 'http://localhost:3000' } },
    caches: { open: async () => cache, match: async () => world.saved, keys: async () => [], delete: async () => true },
    fetch: world.network,
    Response,
    URL,
    location: { origin: 'http://localhost:3000' },
    console: { log: () => undefined, error: () => undefined, warn: () => undefined },
    Promise,
  };
  vm.runInNewContext(source, sandbox);
  return handlers.fetch;
}

/** A same-origin request that is not an API call, a static file or a page: the "default" strategy. */
const prefetch = { url: 'http://localhost:3000/dashboard/governance?_rsc=264m7', method: 'GET', headers: { get: () => 'text/x-component' } };

async function answerFor(world: Parameters<typeof loadWorker>[0]): Promise<unknown> {
  const handler = loadWorker(world);
  let answer: unknown = 'respondWith was never called';
  await new Promise<void>((resolve, reject) => {
    handler({
      request: prefetch,
      respondWith: (p) => {
        Promise.resolve(p).then((value) => { answer = value; resolve(); }, reject);
      },
    });
  });
  return answer;
}

describe('the service worker, for a request it answers from its saved copy or the network', () => {
  it('never answers with nothing when there is no saved copy and the network fails', async () => {
    const answer = await answerFor({ network: () => Promise.reject(new TypeError('Failed to fetch')) });
    expect(answer).toBeInstanceOf(Response); // a real Response, so the browser has something it can use
    expect((answer as Response).type).toBe('error'); // and it behaves as the failed request it was
  });

  it('answers with the saved copy when the network fails and there is one', async () => {
    const saved = new Response('saved', { status: 200 });
    const answer = await answerFor({ saved, network: () => Promise.reject(new TypeError('Failed to fetch')) });
    expect(answer).toBe(saved);
  });

  it('answers with the network when it works', async () => {
    const fresh = new Response('fresh', { status: 200 });
    const answer = await answerFor({ network: () => Promise.resolve(fresh) });
    expect(answer).toBe(fresh);
  });
});
