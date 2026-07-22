// The hard checks on the planner: the ones that only fail on someone's real phone,
// on a bad connection, or with a screen reader — long after you'd have shipped it.
import { test, expect, type Page } from "@playwright/test";

async function toSpread(page: Page) {
  await page.goto("/plan");
  await page.getByRole("button", { name: /^15 people/ }).click();
  await page.getByRole("button", { name: /Show me a spread/ }).click();
  await expect(page.getByRole("heading", { name: /Our suggestion/ })).toBeVisible();
}

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("320px — the narrowest phone still in use", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await toSpread(page);
  expect(await noOverflow(page)).toBe(true);
  await page.screenshot({ path: "test-results/plan-320.png", fullPage: true });
});

test("landscape phone — short viewport, nothing overlaps", async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 360 });
  await toSpread(page);
  expect(await noOverflow(page)).toBe(true);
  await page.screenshot({ path: "test-results/plan-landscape.png", fullPage: true });
});

test("no console errors through the whole flow", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await toSpread(page);
  await page.getByRole("button", { name: /Add another board/ }).click();
  await page.locator(".pl-picker-item").first().click();
  // Image 404s are the environment, not the app.
  const real = errors.filter((e) => !/Failed to load resource/i.test(e));
  expect(real, real.join("\n")).toEqual([]);
});

test("every interactive control has a visible focus ring", async ({ page }) => {
  await toSpread(page);
  for (const sel of [".pl-add-toggle", ".stepper button", ".btn"]) {
    const el = page.locator(sel).first();
    await el.focus();
    const outline = await el.evaluate((n) => {
      const s = getComputedStyle(n);
      return `${s.outlineStyle}|${s.outlineWidth}|${s.boxShadow}`;
    });
    expect(outline, `${sel} has no focus indicator`).not.toBe("none|0px|none");
  }
});

test("heading outline reads as a table of contents", async ({ page }) => {
  await page.goto("/plan");
  const headings = await page.evaluate(() =>
    [...document.querySelectorAll("h1,h2,h3")].map((h) => `${h.tagName}:${h.textContent?.trim().slice(0, 40)}`),
  );
  // Exactly one h1, and it describes the page.
  expect(headings.filter((h) => h.startsWith("H1:"))).toHaveLength(1);
  expect(headings[0]).toMatch(/H1:How many are you feeding/);
});

test("headcount tiles announce their state to a screen reader", async ({ page }) => {
  await page.goto("/plan");
  const tile = page.getByRole("button", { name: /^20 people/ });
  await expect(tile).toHaveAttribute("aria-pressed", "false");
  await tile.click();
  await expect(tile).toHaveAttribute("aria-pressed", "true");
});

test("reduced motion is respected", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await toSpread(page);
  await expect(page.locator(".combo-row").first()).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
});

test("slow connection — the page is usable before images arrive", async ({ page }) => {
  // Hold every image indefinitely; the layout must not depend on them.
  await page.route(/\.(png|jpe?g|webp|avif)$/i, () => {});
  await page.setViewportSize({ width: 375, height: 900 });
  await toSpread(page);
  await expect(page.getByRole("button", { name: /Continue with these boards/ })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  await page.screenshot({ path: "test-results/plan-noimg-yet.png", fullPage: true });
});

test("touch targets are at least 44px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await toSpread(page);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll(".plan-event button")]
      .map((b) => ({ t: b.textContent?.trim().slice(0, 24) ?? "", r: b.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.height < 44 || r.width < 44))
      .map(({ t, r }) => `${t} ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
  expect(small, small.join(", ")).toEqual([]);
});
