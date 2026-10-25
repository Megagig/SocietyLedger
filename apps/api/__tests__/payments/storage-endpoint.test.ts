/**
 * Signed receipt links are opened by phones and browsers, so they must point at an address those can reach. A link signed for
 * `localhost:9000` makes a phone look for storage on itself — the receipt never loads. These cover how the address is chosen.
 */
import { resolvePublicEndpoint } from '../../src/lib/storage';

describe('resolvePublicEndpoint', () => {
  it('uses the configured public address whenever one is set (production)', () => {
    expect(
      resolvePublicEndpoint({ endpoint: 'http://minio:9000', publicEndpoint: 'https://files.example.com', requestHost: '10.0.0.5', nodeEnv: 'production' }),
    ).toBe('https://files.example.com');
  });

  it('in development, points a localhost storage address at the host the caller used, keeping the storage port', () => {
    expect(resolvePublicEndpoint({ endpoint: 'http://localhost:9000', requestHost: '10.210.41.35', nodeEnv: 'development' })).toBe('http://10.210.41.35:9000');
  });

  it('follows the network: a new LAN address gives a new link address with no setting changed', () => {
    const a = resolvePublicEndpoint({ endpoint: 'http://localhost:9000', requestHost: '192.168.8.107', nodeEnv: 'development' });
    const b = resolvePublicEndpoint({ endpoint: 'http://localhost:9000', requestHost: '10.210.41.35', nodeEnv: 'development' });
    expect([a, b]).toEqual(['http://192.168.8.107:9000', 'http://10.210.41.35:9000']);
  });

  it('works for 127.0.0.1 storage too, and for a browser on localhost', () => {
    expect(resolvePublicEndpoint({ endpoint: 'http://127.0.0.1:9000', requestHost: '10.1.1.9', nodeEnv: 'development' })).toBe('http://10.1.1.9:9000');
    expect(resolvePublicEndpoint({ endpoint: 'http://localhost:9000', requestHost: 'localhost', nodeEnv: 'development' })).toBe('http://localhost:9000');
  });

  it('never rewrites an internal address that is not localhost — that needs the public setting', () => {
    expect(resolvePublicEndpoint({ endpoint: 'http://minio:9000', requestHost: '10.210.41.35', nodeEnv: 'development' })).toBe('http://minio:9000');
  });

  it('does not rewrite in production, even for a localhost address', () => {
    expect(resolvePublicEndpoint({ endpoint: 'http://localhost:9000', requestHost: 'api.example.com', nodeEnv: 'production' })).toBe('http://localhost:9000');
  });

  it('leaves the configured address alone when the caller host is unknown', () => {
    expect(resolvePublicEndpoint({ endpoint: 'http://localhost:9000', nodeEnv: 'development' })).toBe('http://localhost:9000');
  });
});

describe('storageConfigProblem', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { storageConfigProblem } = require('../../src/lib/storage');

  it('flags an internal storage address in production when no public address is set', () => {
    for (const endpoint of ['http://minio:9000', 'http://localhost:9000', 'http://10.0.0.5:9000', 'http://192.168.1.4:9000', 'http://172.20.0.2:9000']) {
      expect(storageConfigProblem({ NODE_ENV: 'production', MINIO_ENDPOINT: endpoint })).toContain('MINIO_PUBLIC_ENDPOINT');
    }
  });

  it('is fine when a public address is set, when the endpoint is already public, or outside production', () => {
    expect(storageConfigProblem({ NODE_ENV: 'production', MINIO_ENDPOINT: 'http://minio:9000', MINIO_PUBLIC_ENDPOINT: 'https://files.example.com' })).toBeNull();
    expect(storageConfigProblem({ NODE_ENV: 'production', MINIO_ENDPOINT: 'https://files.example.com' })).toBeNull();
    expect(storageConfigProblem({ NODE_ENV: 'development', MINIO_ENDPOINT: 'http://localhost:9000' })).toBeNull();
  });
});
