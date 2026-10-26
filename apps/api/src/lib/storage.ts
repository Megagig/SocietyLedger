import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// MinIO is S3-compatible — the same AWS SDK client works by pointing endpoint
// at the MinIO server (MINIO_ENDPOINT, e.g. "http://minio:9000" on the Docker network).
// forcePathStyle is required: MinIO uses path-style URLs (host/bucket/key) not
// virtual-hosted-style (bucket.host/key) which is the AWS default.
export const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT!,
  region: process.env.MINIO_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
  forcePathStyle: true,
});

export const STORAGE_BUCKET = process.env.MINIO_BUCKET || 'societyledger';

/** Called once at server startup — creates the bucket if it doesn't already exist. */
export async function ensureBucketExists(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: STORAGE_BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: STORAGE_BUCKET }));
    console.log(`[storage] Created MinIO bucket: ${STORAGE_BUCKET}`);
  }
}

/**
 * Upload a file buffer to MinIO. Returns the storage key (not a full URL).
 * The key is what gets stored in the DB — presigned URLs are generated on demand.
 */
export async function uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: STORAGE_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ContentLength: buffer.length,
  }));
  return key;
}

/**
 * Delete a file from MinIO. Logs but does NOT throw on failure — a failed
 * delete must never roll back a payment approval.
 */
export async function deleteFile(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }));
  } catch (error) {
    console.error('[storage] Delete failed for key:', key, error);
  }
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Which storage address a signed link should point at. The link is opened by a phone or a browser, never by the API, so it must use an
 * address *they* can reach — not the one the API itself uses to talk to storage:
 *  - `MINIO_PUBLIC_ENDPOINT` wins when set. Production needs it whenever `MINIO_ENDPOINT` is internal (e.g. `http://minio:9000`).
 *  - In development, when storage is on `localhost` (so a phone on the LAN would read "localhost" as itself), the link uses the host the
 *    caller reached the API on — your PC's LAN address — keeping the storage port. It follows the network, so nothing needs editing when the IP changes.
 *  - Otherwise the configured endpoint is used unchanged.
 */
export function resolvePublicEndpoint(options: { endpoint: string; publicEndpoint?: string; requestHost?: string; nodeEnv?: string }): string {
  const { endpoint, publicEndpoint, requestHost, nodeEnv } = options;
  if (publicEndpoint) return publicEndpoint;
  if (!requestHost || nodeEnv === 'production') return endpoint;

  try {
    const configured = new URL(endpoint);
    if (!LOOPBACK_HOSTS.has(configured.hostname)) return endpoint;
    configured.hostname = requestHost;
    return configured.toString().replace(/\/$/, '');
  } catch {
    return endpoint;
  }
}

// Signing is a local calculation (no network), so one client per public address is enough.
const signingClients = new Map<string, S3Client>();

function clientFor(endpoint: string): S3Client {
  if (endpoint === process.env.MINIO_ENDPOINT) return s3;
  let client = signingClients.get(endpoint);
  if (!client) {
    client = new S3Client({
      endpoint,
      region: process.env.MINIO_REGION || 'us-east-1',
      credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY!, secretAccessKey: process.env.MINIO_SECRET_KEY! },
      forcePathStyle: true,
    });
    signingClients.set(endpoint, client);
  }
  return client;
}

/**
 * Generate a presigned URL for temporary read access to a private file.
 * Default expiry: 1 hour. The URL is safe to return to a browser — it
 * expires automatically and requires no authentication headers.
 *
 * Pass the caller's host (`req.hostname`) so the link points at an address the caller can open — see `resolvePublicEndpoint`.
 */
export async function getPresignedUrl(key: string, expiresInSeconds = 3600, requestHost?: string): Promise<string> {
  const endpoint = resolvePublicEndpoint({
    endpoint: process.env.MINIO_ENDPOINT!,
    publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT,
    requestHost,
    nodeEnv: process.env.NODE_ENV,
  });

  return getSignedUrl(clientFor(endpoint), new GetObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }), { expiresIn: expiresInSeconds });
}

/** Stable links are signed as if at the start of the current window, so every request inside a window gets the identical URL. */
export const STABLE_URL_WINDOW_SECONDS = 6 * 60 * 60;

/**
 * A private read link that does not change on every request. A normal signed link carries the moment it was made, so the same file
 * gets a different URL each time and phones and browsers download it again (and again for every row of a list). This signs at the start
 * of a six-hour window and stays valid for twelve hours from there, so a link handed out at any point in the window works for at least six
 * hours and is identical for everyone asking in that window. Use it for things shown in lists, such as member photos.
 */
export async function getStablePresignedUrl(key: string, requestHost?: string, now: Date = new Date()): Promise<string> {
  const endpoint = resolvePublicEndpoint({
    endpoint: process.env.MINIO_ENDPOINT!,
    publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT,
    requestHost,
    nodeEnv: process.env.NODE_ENV,
  });
  const windowMs = STABLE_URL_WINDOW_SECONDS * 1000;
  const signingDate = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  return getSignedUrl(clientFor(endpoint), new GetObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }), {
    expiresIn: STABLE_URL_WINDOW_SECONDS * 2,
    signingDate,
  });
}

/**
 * In production, a signed link made from an internal storage address (`http://minio:9000`, localhost, a private IP) can't be opened
 * by a phone or browser, so every receipt, slip and attachment would silently fail to load. Returns what is wrong, or null when fine.
 */
export function storageConfigProblem(env: { NODE_ENV?: string; MINIO_ENDPOINT?: string; MINIO_PUBLIC_ENDPOINT?: string }): string | null {
  if (env.NODE_ENV !== 'production' || env.MINIO_PUBLIC_ENDPOINT || !env.MINIO_ENDPOINT) return null;
  let host: string;
  try {
    host = new URL(env.MINIO_ENDPOINT).hostname;
  } catch {
    return 'MINIO_ENDPOINT is not a valid URL.';
  }
  const internal =
    LOOPBACK_HOSTS.has(host) ||
    !host.includes('.') || // a Docker service name such as "minio"
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  return internal
    ? `MINIO_ENDPOINT (${env.MINIO_ENDPOINT}) is an internal address and MINIO_PUBLIC_ENDPOINT is not set, so receipts, lodgment slips and ticket attachments will not open on phones or browsers. Set MINIO_PUBLIC_ENDPOINT to the address people can reach.`
    : null;
}
