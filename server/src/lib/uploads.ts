// Image uploads. Uses Supabase Storage when configured (works on serverless/Vercel),
// otherwise falls back to local disk for dev. The route only needs a URL back, so the
// rest of the app is storage-agnostic.
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { processImage } from "./image";

// Where disk-stored uploads live. Override with UPLOAD_DIR to point at a mounted
// volume — inside a container the default sits on the ephemeral layer, so every
// redeploy would otherwise wipe the owner's product photos.
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "uploads");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "platter-images";
export const useSupabaseStorage = !!(SUPABASE_URL && SUPABASE_KEY);

/** Which backend uploads land in — surfaced on /api/health so this is checkable in prod. */
export const storageMode = useSupabaseStorage ? "supabase" : ("disk" as const);

// Only create a local upload dir when using disk storage — serverless filesystems are read-only.
if (!useSupabaseStorage) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch {
    /* ignore — read-only FS */
  }
  if (process.env.NODE_ENV === "production" && !process.env.UPLOAD_DIR) {
    console.warn(
      `[uploads] Storing photos on local disk at ${UPLOAD_DIR}. If this is a container ` +
        `without a volume mounted there, uploaded photos will disappear on the next deploy. ` +
        `Set UPLOAD_DIR to a mounted volume, or configure SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.`,
    );
  }
}

let supabase: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (!supabase) supabase = createClient(SUPABASE_URL as string, SUPABASE_KEY as string);
  return supabase;
}

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const newName = (ext: string) => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

/**
 * Uploads are held in memory so they can be resized before anything is written — the file
 * that lands on disk / in the bucket is the web-sized one, never the 12 MP original.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "20 MB";

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    // HEIC is the iPhone default and browsers can't display it, so it's rejected here
    // rather than silently becoming a broken photo on the shop.
    else if (/heic|heif/i.test(file.mimetype))
      cb(new Error("iPhone HEIC photos can't be shown on the web — in Photos, choose Share → Options → Most Compatible, then upload the JPG"));
    else cb(new Error("Please upload an image (JPG, PNG, WebP, GIF or AVIF)"));
  },
});

/** Resize an uploaded file, persist it, and return a public URL. */
export async function persistUpload(file: Express.Multer.File): Promise<string> {
  const image = await processImage(file.buffer);
  const key = newName(image.ext);

  if (useSupabaseStorage) {
    const { error } = await client().storage.from(BUCKET).upload(key, image.buffer, {
      contentType: image.contentType,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return client().storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
  }

  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(UPLOAD_DIR, key), image.buffer);
  return `/uploads/${key}`;
}
