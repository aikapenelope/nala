/**
 * Image processing service using sharp.
 *
 * Optimizes product images on upload:
 * - Converts to WebP (best compression/quality ratio for web)
 * - Resizes to max 1200px on longest edge (preserves aspect ratio)
 * - Strips metadata (EXIF, ICC profiles) to reduce size and remove PII
 * - Applies production-safe limits to prevent resource exhaustion
 *
 * Design decisions:
 * - Single optimized output (no multiple variants) — keeps storage simple
 * - WebP quality 80 with effort 4 — balanced quality/speed per sharp docs
 * - fit: "inside" + withoutEnlargement — never upscales small images
 * - Graceful fallback: if processing fails, returns null (caller uses original)
 * - Concurrency limited to prevent memory pressure on single-server deploy
 *
 * References:
 * - https://sharp.pixelplumbing.com/api-resize
 * - https://sharp.pixelplumbing.com/api-output#webp
 * - https://sharp.pixelplumbing.com/api-constructor
 * - https://sharp.pixelplumbing.com/install#docker
 */

import sharp from "sharp";
import { logger } from "../logger";

/**
 * Configure sharp for production:
 * - Limit concurrency to 2 threads (single-server, shared with API)
 * - Limit cache to 20MB (prevent memory bloat in long-running process)
 *
 * Per sharp docs: glibc Linux without jemalloc defaults to 1 thread.
 * We explicitly set 2 for predictable behavior across environments.
 */
sharp.cache({ memory: 20, files: 10, items: 50 });
sharp.concurrency(2);

/** Maximum dimension (width or height) for processed images. */
const MAX_DIMENSION = 1200;

/** WebP quality (1-100). 80 is sharp's default and recommended for photos. */
const WEBP_QUALITY = 80;

/**
 * WebP encoding effort (0-6). Higher = smaller file but slower.
 * 4 is sharp's default — good balance for upload-time processing.
 */
const WEBP_EFFORT = 4;

/**
 * Maximum input pixels allowed (width * height).
 * Default: 268 megapixels (sharp default). Prevents decompression bombs.
 */
const MAX_INPUT_PIXELS = 268402689;

export interface ProcessedImage {
  /** Optimized image buffer (WebP format). */
  buffer: Buffer;
  /** MIME type of the output (always image/webp). */
  contentType: "image/webp";
  /** Width of the processed image in pixels. */
  width: number;
  /** Height of the processed image in pixels. */
  height: number;
  /** Original file size in bytes (before processing). */
  originalSize: number;
  /** Processed file size in bytes. */
  processedSize: number;
}

/**
 * Process a product image for optimal web delivery.
 *
 * Converts to WebP, resizes to max 1200px, strips metadata.
 * Returns null if processing fails (caller should use original as fallback).
 *
 * @param input - Raw image buffer from upload (JPEG, PNG, or WebP)
 * @returns Processed image data, or null if processing failed
 */
export async function processProductImage(
  input: Buffer,
): Promise<ProcessedImage | null> {
  try {
    const result = await sharp(input, {
      // Production safety: reject corrupt/malicious images early
      failOn: "error",
      // Prevent decompression bombs (e.g., 1x1 pixel JPEG with huge dimensions)
      limitInputPixels: MAX_INPUT_PIXELS,
      // Sequential read is more memory-efficient for single-pass processing
      sequentialRead: true,
    })
      .rotate() // Auto-rotate based on EXIF orientation (before stripping metadata)
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside", // Scale to fit within bounds, preserve aspect ratio
        withoutEnlargement: true, // Never upscale small images
        kernel: "lanczos3", // Best quality downsampling (sharp default)
      })
      .webp({
        quality: WEBP_QUALITY,
        effort: WEBP_EFFORT,
        smartSubsample: true, // Better chroma subsampling for photos
        preset: "photo", // Optimized for photographic content
      })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: result.data,
      contentType: "image/webp",
      width: result.info.width,
      height: result.info.height,
      originalSize: input.length,
      processedSize: result.data.length,
    };
  } catch (err) {
    // Log but don't throw — caller will use original as fallback
    const message = err instanceof Error ? err.message : String(err);
    logger.error("image-processing", "Failed to process image", { error: message });
    return null;
  }
}
