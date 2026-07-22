// Photo uploads are the one place a non-technical owner can put arbitrary bytes into the
// live shop, so the resize step is checked rather than assumed.
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processImage, ImageRejected, MAX_DIM } from "../src/lib/image";

// sharp can't synthesise a multi-frame GIF, so this is a hand-built 1x1 two-frame one.
const ANIMATED_GIF = Buffer.from(
  "R0lGODlhAQABAPAAAAAAAP///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAQABAAACAkQBACH5BAAKAAAALAAAAAABAAEAAAICTAEAOw==",
  "base64",
);

const solid = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 60, b: 40 } } });

describe("processImage", () => {
  it("shrinks an oversized phone photo to the web size and converts to WebP", async () => {
    const big = await solid(4032, 3024).jpeg().toBuffer();
    const out = await processImage(big);

    expect(out.contentType).toBe("image/webp");
    expect(out.ext).toBe(".webp");
    const meta = await sharp(out.buffer).metadata();
    expect(meta.width).toBe(MAX_DIM);
    expect(meta.height).toBe(1200); // aspect ratio preserved
    expect(out.buffer.length).toBeLessThan(big.length);
  });

  it("leaves an already-small photo at its original dimensions", async () => {
    const small = await solid(600, 400).png().toBuffer();
    const meta = await sharp((await processImage(small)).buffer).metadata();
    expect(meta.width).toBe(600);
    expect(meta.height).toBe(400);
  });

  it("applies the EXIF rotation flag so portrait photos aren't stored sideways", async () => {
    // orientation 6 = "rotate 90° clockwise on display", what an iPhone writes for a portrait shot.
    const sideways = await solid(1000, 500).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const meta = await sharp((await processImage(sideways)).buffer).metadata();
    expect(meta.width).toBe(500);
    expect(meta.height).toBe(1000);
  });

  it("strips EXIF, so a photo taken at the shop doesn't publish its GPS location", async () => {
    const withExif = await solid(800, 600).withMetadata({ exif: { IFD0: { Copyright: "Kelly" } } }).jpeg().toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeTruthy();
    expect((await sharp((await processImage(withExif)).buffer).metadata()).exif).toBeUndefined();
  });

  it("passes an animated GIF through untouched rather than freezing it", async () => {
    const out = await processImage(ANIMATED_GIF);
    expect(out.contentType).toBe("image/gif");
    expect(out.ext).toBe(".gif");
    expect(out.processed).toBe(false);
    expect(out.buffer).toEqual(ANIMATED_GIF);
  });

  it("refuses an animated image too heavy to serve, since it can't be shrunk", async () => {
    const bloated = Buffer.concat([ANIMATED_GIF, Buffer.alloc(6 * 1024 * 1024)]);
    await expect(processImage(bloated)).rejects.toBeInstanceOf(ImageRejected);
  });

  it("rejects a file that claims to be an image but isn't", async () => {
    await expect(processImage(Buffer.from("<?php echo 'not a photo'; ?>"))).rejects.toBeInstanceOf(ImageRejected);
  });
});
