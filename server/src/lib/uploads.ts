// Image uploads. Uses Supabase Storage when configured (works on serverless/Vercel),
// otherwise falls back to local disk for dev. The route only needs a URL back, so the
// rest of the app is storage-agnostic.
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
const cleanExt = (name: string) => (path.extname(name) || ".jpg").toLowerCase().replace(/[^.a-z0-9]/g, "") || ".jpg";
const newName = (name: string) => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${cleanExt(name)}`;

const storage = useSupabaseStorage
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
      filename: (_req, file, cb) => cb(null, newName(file.originalname)),
    });

export const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error("Please upload an image (JPG, PNG, WebP, GIF or AVIF)"));
  },
});

/** Persist an uploaded file and return a public URL. */
export async function persistUpload(file: Express.Multer.File): Promise<string> {
  if (useSupabaseStorage) {
    const key = newName(file.originalname);
    const { error } = await client().storage.from(BUCKET).upload(key, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return client().storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
  }
  return `/uploads/${file.filename}`; // disk (multer already wrote the file)
}
