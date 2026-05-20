/**
 * MinIO/S3 storage service for file uploads.
 *
 * Uses the AWS S3 SDK to interact with MinIO (S3-compatible).
 * Handles bucket creation, file upload, and image streaming.
 *
 * Environment variables:
 * - MINIO_ENDPOINT: MinIO server URL (e.g., http://10.0.1.20:9000)
 * - MINIO_ACCESS_KEY: Access key for authentication
 * - MINIO_SECRET_KEY: Secret key for authentication
 * - MINIO_BUCKET: Bucket name for all Nova files (default: nova-media)
 * - MINIO_REGION: Region (default: us-east-1)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "../logger";

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? "http://10.0.1.20:9000";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? "";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? "";
const MINIO_BUCKET = process.env.MINIO_BUCKET ?? "nova-media";
const MINIO_REGION = process.env.MINIO_REGION ?? "us-east-1";

/** Whether MinIO is configured (has credentials). */
export const isStorageConfigured =
  MINIO_ACCESS_KEY.length > 0 && MINIO_SECRET_KEY.length > 0;

/** S3 client instance (lazy initialized). */
let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: MINIO_ENDPOINT,
      region: MINIO_REGION,
      credentials: {
        accessKeyId: MINIO_ACCESS_KEY,
        secretAccessKey: MINIO_SECRET_KEY,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }
  return s3Client;
}

/**
 * Legacy bucket name used before the nova-media consolidation (PR #266).
 * Images uploaded before that change live here. We migrate them on startup.
 */
const LEGACY_BUCKET = "order-proofs";

/**
 * Initialize storage: verify connectivity, ensure the bucket exists,
 * and migrate objects from the legacy bucket if needed.
 *
 * Must be called once at startup. Logs clearly whether storage is ready.
 *
 * Migration strategy (idempotent, safe to run on every deploy):
 * 1. Ensure the current bucket (nova-media) exists.
 * 2. Check if the legacy bucket (order-proofs) exists.
 * 3. If it does, list all objects and copy any that don't already exist
 *    in the current bucket. This handles partial migrations gracefully.
 * 4. Log a summary of migrated vs skipped objects.
 */
export async function initStorage(): Promise<void> {
  if (!isStorageConfigured) {
    logger.warn("storage", "MinIO not configured, file uploads disabled");
    return;
  }

  logger.info("storage", "Connecting to MinIO", {
    endpoint: MINIO_ENDPOINT,
    bucket: MINIO_BUCKET,
  });

  const client = getClient();

  // --- Step 1: Ensure the current bucket exists ---
  const bucketReady = await ensureBucketExists(client, MINIO_BUCKET);
  if (!bucketReady) {
    // Error already logged by ensureBucketExists. Server continues but
    // uploads will fail with clear errors.
    return;
  }

  // --- Step 2: Migrate from legacy bucket if it exists ---
  if (MINIO_BUCKET !== LEGACY_BUCKET) {
    await migrateLegacyBucket(client);
  }

  logger.info("storage", "Storage ready");
}

/**
 * Ensure a bucket exists, creating it if necessary.
 * @returns true if the bucket is accessible, false on failure.
 */
async function ensureBucketExists(
  client: S3Client,
  bucket: string,
): Promise<boolean> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    logger.info("storage", "Bucket verified", { bucket });
    return true;
  } catch {
    // Bucket doesn't exist — try to create it
    logger.warn("storage", "Bucket not found, creating", { bucket });
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      logger.info("storage", "Bucket created", { bucket });
      return true;
    } catch (createErr) {
      const msg =
        createErr instanceof Error ? createErr.message : String(createErr);
      logger.error("storage", "Cannot create bucket", { bucket, error: msg });
      return false;
    }
  }
}

/**
 * Migrate all objects from the legacy bucket to the current bucket.
 *
 * Uses server-side CopyObject (no data leaves MinIO). Skips objects that
 * already exist in the destination (checked via HeadObject). Handles
 * pagination for buckets with >1000 objects.
 *
 * This is idempotent: running it multiple times is safe and fast because
 * already-migrated objects are skipped via HeadObject.
 */
async function migrateLegacyBucket(client: S3Client): Promise<void> {
  // Check if legacy bucket exists
  try {
    await client.send(new HeadBucketCommand({ Bucket: LEGACY_BUCKET }));
  } catch {
    // Legacy bucket doesn't exist — nothing to migrate
    return;
  }

  logger.info("storage", "Legacy bucket found, checking for objects to migrate", {
    bucket: LEGACY_BUCKET,
  });

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  let continuationToken: string | undefined;

  do {
    const listResponse = await client.send(
      new ListObjectsV2Command({
        Bucket: LEGACY_BUCKET,
        ContinuationToken: continuationToken,
      }),
    );

    const objects = listResponse.Contents ?? [];

    for (const obj of objects) {
      if (!obj.Key) continue;

      // Check if the object already exists in the destination bucket
      try {
        await client.send(
          new HeadObjectCommand({ Bucket: MINIO_BUCKET, Key: obj.Key }),
        );
        // Already exists — skip
        skipped++;
        continue;
      } catch {
        // Doesn't exist in destination — proceed with copy
      }

      // Server-side copy: data stays within MinIO, no download/upload
      try {
        await client.send(
          new CopyObjectCommand({
            Bucket: MINIO_BUCKET,
            Key: obj.Key,
            CopySource: `${LEGACY_BUCKET}/${obj.Key}`,
          }),
        );
        migrated++;
      } catch (copyErr) {
        const msg =
          copyErr instanceof Error ? copyErr.message : String(copyErr);
        logger.error("storage", "Failed to migrate object", {
          key: obj.Key,
          error: msg,
        });
        failed++;
      }
    }

    continuationToken = listResponse.IsTruncated
      ? listResponse.NextContinuationToken
      : undefined;
  } while (continuationToken);

  if (migrated > 0 || failed > 0) {
    logger.info("storage", "Legacy migration complete", {
      migrated,
      skipped,
      failed,
    });
  } else if (skipped > 0) {
    logger.info("storage", "Legacy migration: all objects already migrated", {
      skipped,
      bucket: MINIO_BUCKET,
    });
  }
}

/** Allowed MIME types for image uploads. */
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Max file size: 5MB. */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Map MIME type to file extension. */
function mimeToExt(contentType: string): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "webp";
}

/**
 * Upload a payment proof image to MinIO.
 *
 * @param businessId - Business UUID
 * @param orderId - Order UUID
 * @param fileBuffer - File content as Buffer
 * @param contentType - MIME type of the file
 * @returns The storage key (path) of the uploaded file
 */
export async function uploadPaymentProof(
  businessId: string,
  orderId: string,
  fileBuffer: Buffer,
  contentType: string,
): Promise<{ key: string }> {
  if (!isStorageConfigured) {
    throw new Error("Storage not configured");
  }

  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error("Tipo de archivo no permitido. Solo JPEG, PNG o WebP.");
  }

  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error("Archivo demasiado grande. Maximo 5MB.");
  }

  const key = `${businessId}/${orderId}.${mimeToExt(contentType)}`;

  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    }),
  );

  return { key };
}

/**
 * Upload a product image to MinIO.
 *
 * Key format: products/{businessId}/{productId}/{imageId}.{ext}
 * The imageId makes each image unique within a product, supporting galleries.
 *
 * @param businessId - Business UUID
 * @param productId - Product UUID
 * @param imageId - Image UUID (unique per image in the gallery)
 * @param fileBuffer - File content as Buffer
 * @param contentType - MIME type of the file
 * @returns The storage key (path) of the uploaded file
 */
export async function uploadProductImage(
  businessId: string,
  productId: string,
  imageId: string,
  fileBuffer: Buffer,
  contentType: string,
): Promise<{ key: string }> {
  if (!isStorageConfigured) {
    throw new Error("Storage not configured");
  }

  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error("Tipo de archivo no permitido. Solo JPEG, PNG o WebP.");
  }

  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error("Archivo demasiado grande. Maximo 5MB.");
  }

  const key = `products/${businessId}/${productId}/${imageId}.${mimeToExt(contentType)}`;

  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    }),
  );

  return { key };
}

/**
 * Delete a product image from MinIO.
 *
 * @param storageKey - The storage key of the image to delete
 */
export async function deleteProductImage(storageKey: string): Promise<void> {
  if (!isStorageConfigured || !storageKey) return;

  try {
    const client = getClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: MINIO_BUCKET, Key: storageKey }),
    );
  } catch {
    // Non-critical: orphaned files in MinIO are harmless.
    // Log but don't throw — the DB record is the source of truth.
    logger.warn("storage", "Failed to delete object", { key: storageKey });
  }
}

/**
 * Generate a presigned URL for viewing a payment proof.
 * URL expires in 1 hour.
 *
 * @param key - Storage key from uploadPaymentProof
 * @returns Presigned URL string
 */
export async function getProofUrl(key: string): Promise<string> {
  if (!isStorageConfigured) {
    throw new Error("Storage not configured");
  }

  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: 3600 });
}

/**
 * Get a product image as a readable stream from MinIO.
 * Used by the proxy endpoint to serve images without exposing MinIO.
 *
 * Handles two formats stored in the DB:
 * - Storage key (current): "products/businessId/productId.jpg"
 * - Legacy presigned URL (pre-fix): "http://...?X-Amz-..." — extracts the key
 *
 * @param keyOrUrl - Storage key or legacy presigned URL
 * @returns Object with body stream, content type, and ETag, or null if not found
 */
export async function getProductImageStream(
  keyOrUrl: string,
): Promise<{
  body: ReadableStream;
  contentType: string;
  contentLength: number | null;
  etag: string | null;
} | null> {
  if (!isStorageConfigured || !keyOrUrl) {
    return null;
  }

  // Determine the storage key
  let key: string;

  if (keyOrUrl.startsWith("products/")) {
    key = keyOrUrl;
  } else if (keyOrUrl.startsWith("http")) {
    try {
      const url = new URL(keyOrUrl);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const productsIdx = pathParts.indexOf("products");
      if (productsIdx === -1) return null;
      key = pathParts.slice(productsIdx).join("/");
    } catch {
      return null;
    }
  } else {
    return null;
  }

  try {
    const client = getClient();
    const response = await client.send(
      new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key }),
    );

    if (!response.Body) return null;

    // Use the content type from S3 metadata (set during upload).
    // Fall back to extension-based detection if metadata is missing.
    let contentType = response.ContentType;
    if (!contentType || contentType === "application/octet-stream") {
      const ext = key.split(".").pop()?.toLowerCase();
      contentType =
        ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "png"
            ? "image/png"
            : ext === "webp"
              ? "image/webp"
              : "application/octet-stream";
    }

    return {
      body: response.Body.transformToWebStream() as ReadableStream,
      contentType,
      contentLength: response.ContentLength ?? null,
      etag: response.ETag ?? null,
    };
  } catch {
    return null;
  }
}
