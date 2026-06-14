// Image upload handling (local disk for dev). Files are written to server/uploads and
// served statically at /uploads. For production (Vercel serverless has an ephemeral
// filesystem) swap this for Supabase Storage / S3 — the route only depends on getting
// back a URL string, so the rest of the app is unaffected.
import multer from "multer";
import path from "node:path";
import fs from "node:fs";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || ".jpg").toLowerCase().replace(/[^.a-z0-9]/g, "") || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

export const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error("Please upload an image (JPG, PNG, WebP, GIF or AVIF)"));
  },
});
