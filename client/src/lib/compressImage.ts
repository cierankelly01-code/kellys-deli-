// Client-side photo compression before upload: phone camera shots are 3–12 MB and the
// API caps uploads at 5 MB, so downscale to a sensible web size (max 1600px, JPEG q0.8)
// on-device. Any failure falls back to the original file — the server still enforces its limit.

const MAX_DIM = 1600;
const QUALITY = 0.8;
const SKIP_UNDER_BYTES = 300 * 1024; // already small enough — don't recompress
const SKIP_TYPES = ["image/gif", "image/svg+xml"]; // animation / vectors: recompressing loses more than it saves

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}

export async function compressImage(file: File): Promise<File> {
  if (file.size < SKIP_UNDER_BYTES || SKIP_TYPES.includes(file.type)) return file;
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
