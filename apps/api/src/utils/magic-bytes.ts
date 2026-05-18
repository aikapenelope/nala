/**
 * Magic bytes validation for image uploads.
 *
 * Validates the actual file content (first bytes) against known image
 * format signatures. This is defense-in-depth: even if Content-Type
 * is spoofed, the file must actually be a valid image format.
 *
 * Supported formats: JPEG, PNG, WebP (matching our allowed MIME types).
 *
 * References:
 * - JPEG: starts with FF D8 FF
 * - PNG: starts with 89 50 4E 47 0D 0A 1A 0A
 * - WebP: starts with "RIFF" + 4 bytes + "WEBP"
 */

/** Minimum bytes needed to identify any supported format. */
const MIN_HEADER_SIZE = 12;

/**
 * Validate that a buffer contains a real image by checking magic bytes.
 *
 * @param buffer - File content buffer
 * @returns The detected MIME type, or null if not a recognized image format
 */
export function detectImageType(
  buffer: Buffer,
): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buffer.length < MIN_HEADER_SIZE) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: "RIFF" + 4 bytes (file size) + "WEBP"
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Validate that a buffer is a supported image format.
 *
 * @param buffer - File content buffer
 * @returns true if the buffer starts with valid image magic bytes
 */
export function isValidImageBuffer(buffer: Buffer): boolean {
  return detectImageType(buffer) !== null;
}
