// Client-side photo compression before upload: phone camera shots are 3–12 MB, so downscale
// on-device (max 1600px, JPEG q0.8) to save the owner's mobile data and a long upload wait.
// This is an optimisation only — any failure falls back to the original file, and the server
// re-does the resize authoritatively (server/src/lib/image.ts) before storing anything.

const MAX_DIM = 1600;
const QUALITY = 0.8;
const SKIP_UNDER_BYTES = 300 * 1024; // already small enough — don't recompress
const SKIP_TYPES = ["image/gif", "image/svg+xml"]; // animation / vectors: recompressing loses more than it saves
// Formats the shop can actually display. Anything else (notably iPhone HEIC, which Safari
// can decode but no server or browser will render) is converted regardless of how small it is.
const WEB_SAFE = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // `imageOrientation: "from-image"` is essential: without it createImageBitmap ignores the
  // EXIF rotation flag, so a portrait phone photo gets baked into the canvas lying on its side.
  if ("createImageBitmap" in window) return createImageBitmap(file, { imageOrientation: "from-image" });
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}

export async function compressImage(file: File): Promise<File> {
  if (SKIP_TYPES.includes(file.type)) return file;
  if (file.size < SKIP_UNDER_BYTES && WEB_SAFE.includes(file.type)) return file;
  try {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file; // compression didn't help
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
