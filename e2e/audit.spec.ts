import { test, expect, type Page } from "@playwright/test";

// Static audit (build spec §6.4): each page loads with no console errors / page errors,
// and no leftover "[CHECK PRICE]" markers leak into customer-facing copy.
const PAGES = ["/", "/platters", "/plan", "/privacy", "/terms"];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

for (const path of PAGES) {
  test(`no console errors on ${path}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    // Ignore benign favicon/analytics noise if any.
    const real = errors.filter((e) => !/favicon|analytics|net::ERR_/i.test(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });
}

test("the Staff link is reachable from the main customer pages", async ({ page }) => {
  for (const path of ["/", "/platters", "/plan"]) {
    await page.goto(path);
    const staff = page.getByRole("link", { name: "Staff" });
    await expect(staff).toBeVisible();
    await expect(staff).toHaveAttribute("href", "/admin");
  }
});

test("customer copy hides the [CHECK PRICE] admin marker", async ({ page }) => {
  await page.goto("/platters");
  await expect(page.getByText(/\[CHECK PRICE/i)).toHaveCount(0);
});

test("board images expose accessible names (alt / aria-label)", async ({ page }) => {
  await page.goto("/platters");
  const imgs = page.locator(".board-card-img, .gallery-card .board-card-img");
  const count = await imgs.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(imgs.nth(i)).toHaveAttribute("aria-label", /.+/);
  }
});
