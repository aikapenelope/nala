/**
 * Image enhancement service using fal.ai BiRefNet.
 *
 * Removes the background from a product image and composites it onto
 * a clean white background for professional catalog appearance.
 *
 * Flow:
 * 1. Upload the original image to fal.ai storage (temporary, auto-deleted)
 * 2. Call BiRefNet for background removal (returns PNG with transparency)
 * 3. Download the result
 * 4. Composite onto white background and convert to WebP with sharp
 *
 * Design decisions:
 * - BiRefNet "General Use (Light)" model: best quality/speed ratio for products
 * - 1024x1024 operating resolution: sufficient for product photos
 * - refine_foreground: true for cleaner edges
 * - White background (#FFFFFF) via sharp flatten: standard for e-commerce
 * - Output as WebP: consistent with the image processing pipeline
 * - Graceful error handling: returns null on failure, caller keeps original
 *
 * References:
 * - https://fal.ai/models/fal-ai/birefnet/api
 * - https://github.com/fal-ai/fal-js
 *
 * Environment:
 * - FAL_KEY: fal.ai API key (required, set as env var or Pulumi secret)
 */

import { fal } from "@fal-ai/client";
import sharp from "sharp";

/** Configure fal.ai client from environment. */
const FAL_KEY = process.env.FAL_KEY ?? "";

/** Whether the enhancement service is configured. */
export const isEnhanceConfigured = FAL_KEY.length > 0;

// Configure fal credentials if available
if (isEnhanceConfigured) {
  fal.config({ credentials: FAL_KEY });
}

/** Maximum input file size for enhancement (10MB). */
const MAX_ENHANCE_SIZE = 10 * 1024 * 1024;

/**
 * Timeout for the fal.ai enhancement call (milliseconds).
 * Set to 25s — below the global 30s request timeout so we can
 * return a clear error message instead of a generic timeout.
 */
const ENHANCE_TIMEOUT_MS = 25_000;

/** WebP quality for the final enhanced output. */
const ENHANCED_WEBP_QUALITY = 85;

/** Maximum dimension for the enhanced output. */
const MAX_ENHANCED_DIMENSION = 1200;

export interface EnhancedImage {
  /** Final image buffer (WebP, white background). */
  buffer: Buffer;
  /** MIME type (always image/webp). */
  contentType: "image/webp";
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
}

/**
 * Enhance a product image by removing its background and placing it
 * on a clean white background.
 *
 * @param imageBuffer - Original image buffer (JPEG, PNG, or WebP)
 * @param publicImageUrl - Publicly accessible URL of the image (for fal.ai to fetch)
 * @returns Enhanced image data, or null if enhancement failed
 */
export async function enhanceProductImage(
  imageBuffer: Buffer,
  publicImageUrl: string,
): Promise<EnhancedImage | null> {
  if (!isEnhanceConfigured) {
    console.warn("[image-enhance] FAL_KEY not configured. Enhancement disabled.");
    return null;
  }

  if (imageBuffer.length > MAX_ENHANCE_SIZE) {
    console.warn("[image-enhance] Image too large for enhancement:", imageBuffer.length);
    return null;
  }

  try {
    // Step 1: Call BiRefNet for background removal with timeout.
    // Uses the public image URL so fal.ai can fetch it directly.
    // AbortController ensures we don't hang past the global 30s timeout.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ENHANCE_TIMEOUT_MS);

    let result;
    try {
      result = await fal.subscribe("fal-ai/birefnet", {
        input: {
          image_url: publicImageUrl,
          model: "General Use (Light)",
          operating_resolution: "1024x1024",
          output_format: "png",
          refine_foreground: true,
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Check if aborted
    if (controller.signal.aborted) {
      console.error("[image-enhance] Timeout: fal.ai took longer than 25s");
      return null;
    }

    const outputUrl = result.data?.image?.url;
    if (!outputUrl) {
      console.error("[image-enhance] BiRefNet returned no image URL");
      return null;
    }

    // Step 2: Download the background-removed PNG from fal.ai CDN.
    const response = await fetch(outputUrl, { signal: controller.signal });
    if (!response.ok) {
      console.error("[image-enhance] Failed to download result:", response.status);
      return null;
    }

    const transparentBuffer = Buffer.from(await response.arrayBuffer());

    // Step 3: Composite onto white background and convert to optimized WebP.
    // sharp.flatten() replaces transparency with the specified background color.
    const enhanced = await sharp(transparentBuffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .resize(MAX_ENHANCED_DIMENSION, MAX_ENHANCED_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
        kernel: "lanczos3",
      })
      .webp({
        quality: ENHANCED_WEBP_QUALITY,
        effort: 4,
        smartSubsample: true,
        preset: "photo",
      })
      .toBuffer({ resolveWithObject: true });

    console.log(
      `[image-enhance] Success: ${imageBuffer.length} → ${enhanced.data.length} bytes ` +
        `(${enhanced.info.width}x${enhanced.info.height}px, white background)`,
    );

    return {
      buffer: enhanced.data,
      contentType: "image/webp",
      width: enhanced.info.width,
      height: enhanced.info.height,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[image-enhance] Enhancement failed: ${message}`);
    return null;
  }
}
