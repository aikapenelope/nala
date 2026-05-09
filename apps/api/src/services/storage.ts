/**
 * MinIO/S3 storage service for file uploads.
 *
 * Uses the AWS S3 SDK to interact with MinIO (S3-compatible).
 * Handles bucket creation, file upload, and presigned URL generation.
 *
 * Environment variables:
 * - MINIO_ENDPOINT: MinIO server URL (e.g., http://10.0.1.20:9000)
 * - MINIO_ACCESS_KEY: Access key for authentication
 * - MINIO_SECRET_KEY: Secret key for authentication
 * - MINIO_BUCKET: Bucket name (default: order-proofs)
 * - MINIO_REGION: Region (default: us-east-1)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? "http://10.0.1.20:9000";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? "";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? "";
const MINIO_BUCKET = process.env.MINIO_BUCKET ?? "order-proofs";
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
 * Ensure the bucket exists. Creates it if not found.
 * Called once at startup.
 */
export async function ensureBucket(): Promise<void> {
  if (!isStorageConfigured) {
    console.warn("[storage] MinIO not configured. File uploads disabled.");
    return;
  }

  const client = getClient();

  try {
    await client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
  } catch {
    // Bucket doesn't exist, create it
    try {
      await client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }));
      console.log(`[storage] Created bucket: ${MINIO_BUCKET}`);
    } catch (createErr) {
      console.error("[storage] Failed to create bucket:", createErr);
    }
  }
}

/** Allowed MIME types for payment proof uploads. */
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Max file size: 5MB. */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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

  // Validate content type
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error(
      `Tipo de archivo no permitido. Solo JPEG, PNG o WebP.`,
    );
  }

  // Validate file size
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error("Archivo demasiado grande. Maximo 5MB.");
  }

  // Determine file extension
  const ext = contentType === "image/jpeg"
    ? "jpg"
    : contentType === "image/png"
      ? "png"
      : "webp";

  const key = `${businessId}/${orderId}.${ext}`;

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
