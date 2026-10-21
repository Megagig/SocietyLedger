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

/**
 * Generate a presigned URL for temporary read access to a private file.
 * Default expiry: 1 hour. The URL is safe to return to a browser — it
 * expires automatically and requires no authentication headers.
 */
export async function getPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}
