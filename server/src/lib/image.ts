// Server-side image processing for admin photo uploads.
//
// The browser already downscales before upload (client/src/lib/compressImage.ts), but that
// is a bandwidth optimisation, not a guarantee: it silently falls back to the original file
// whenever the canvas step fails (iOS Safari refuses very large images), and it can be
// bypassed entirely by posting to /api/admin/upload directly. So the server re-does the work
// authoritatively — every stored photo is web-sized, correctly rotated, and stripped of the
// EXIF block (which on a phone photo carries the GPS coordinates of the shop).
import sharp from "sharp";

/** Longest edge of a stored photo. Matches the client-side constant. */
export const MAX_DIM = 1600;
const WEBP_QUALITY = 80;

/** Animated images can't be resized without losing the animation, so they pass through — but not at any size. */
const MAX_ANIMATED_BYTES = 5 * 1024 * 1024;

export type ProcessedImage = {
  buffer: Buffer;
  contentType: string;
  ext: string;
  /** True when the bytes were re-encoded; false for a validated pass-through. */
  processed: boolean;
};

/** Thrown for input we refuse to store. The message is shown to the owner, so keep it plain English. */
export class ImageRejected extends Error {}

/**
 * Validate and web-optimise an uploaded image.
 * Throws {@link ImageRejected} if the bytes aren't a readable image — a file can claim
 * image/jpeg in its multipart header and contain anything at all.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const meta = await sharp(input).metadata().catch(() => null);
  if (!meta?.format) throw new ImageRejected("That file isn't an image we can read — please try a JPG or PNG");

  // Animated (GIF, animated WebP): re-encoding would freeze it, so store as-is once validated.
  if ((meta.pages ?? 1) > 1) {
    if (input.length > MAX_ANIMATED_BYTES) {
      throw new ImageRejected("Animated images need to be under 5 MB — please use a still photo instead");
    }
    return {
      buffer: input,
      contentType: meta.format === "gif" ? "image/gif" : `image/${meta.format}`,
      ext: `.${meta.format}`,
      processed: false,
    };
  }

  // .rotate() with no argument applies the EXIF orientation flag and drops it, so portrait
  // phone photos stop appearing sideways. Metadata is not copied to the output by default.
  const buffer = await sharp(input)
    .rotate()
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return { buffer, contentType: "image/webp", ext: ".webp", processed: true };
}
