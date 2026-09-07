import { z } from "zod";
const parseUrl = (s: string) => { try { return new URL(s); } catch { return null; } };
const httpsUrl = z.string().max(1000).url().refine((s) => parseUrl(s)?.protocol === "https:", "Use an HTTPS file URL");
export const deliVideosSchema = z.array(z.object({
  title: z.string().trim().min(1).max(100),
  url: httpsUrl.refine((s) => /\.(mp4|webm)$/i.test(parseUrl(s)?.pathname ?? ""), "Use a direct MP4 or WebM file URL"),
  poster: httpsUrl,
  captions: z.union([httpsUrl, z.literal("")]).default(""),
  productId: z.string().max(100).regex(/^[a-zA-Z0-9_-]*$/),
})).max(6);
