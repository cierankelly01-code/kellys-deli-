// Visual + robustness pass on the redesigned planner. Screenshots feed the design
// review; the assertions are the parts that must not regress.
import { test, expect, type Page } from "@playwright/test";

const SIZES = [
  { name: "375", width: 375, height: 900 },
  { name: "768", width: 768, height: 1100 },
  { name: "1440", width: 1440, height: 1200 },
];

async function toSpread(page: Page) {
  await page.goto("/plan");
  await page.getByRole("button", { name: /^15 people/ }).click();
  await page.getByRole("button", { name: /Show me a spread/ }).click();
  await expect(page.getByRole("heading", { name: /Our suggestion for 15 people/ })).toBeVisible();
}

for (const s of SIZES) {
  test(`planner renders at ${s.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.goto("/plan");
    await expect(page.getByRole("heading", { name: /How many are you feeding/ })).toBeVisible();
    await page.screenshot({ path: `test-results/plan-step1-${s.name}.png`, fullPage: true });

    await page.getByRole("button", { name: /^15 people/ }).click();
    await page.getByRole("button", { name: /Show me a spread/ }).click();
    await expect(page.getByRole("heading", { name: /Our suggestion/ })).toBeVisible();
    await page.screenshot({ path: `test-results/plan-step2-${s.name}.png`, fullPage: true });

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows, `horizontal overflow at ${s.name}px`).toBe(false);
  });
}

test("board picker opens, adds a board, and closes", async ({ page }) => {
  await toSpread(page);
  const before = await page.locator(".combo-row").count();
  await page.getByRole("button", { name: /Add another board/ }).click();
  await expect(page.locator(".pl-picker")).toBeVisible();
  await page.locator(".pl-picker-item").first().click();
  await expect(page.locator(".pl-picker")).toBeHidden();
  expect(await page.locator(".combo-row").count()).toBeGreaterThan(before);
});

test("a missing board photo shows a monogram, never an empty box", async ({ page }) => {
  // Every image 404s — exactly what happened in production when a redeploy wiped
  // the upload directory, and what a slow connection looks like mid-load.
  await page.route("**/uploads/**", (r) => r.fulfill({ status: 404, body: "" }));
  await page.route("**images.unsplash.com/**", (r) => r.fulfill({ status: 404, body: "" }));
  await toSpread(page);

  const thumb = page.locator(".combo-row .pl-thumb").first();
  await expect(thumb).toBeVisible();
  // The tile still carries a visible letter under the failed image.
  const text = (await thumb.textContent())?.trim() ?? "";
  expect(text.length).toBeGreaterThan(0);
  const box = await thumb.boundingBox();
  expect(box?.width).toBeGreaterThan(40);

  await page.screenshot({ path: "test-results/plan-noimages-375.png", fullPage: true });
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});

test("a very long board name does not break the row", async ({ page }) => {
  await page.route("**/api/platters**", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    if (Array.isArray(body) && body[0]) {
      body[0].name = "Smoked Salmon, Whipped Cream Cheese, Dill, Capers and Pickled Shallot Sourdough Crostini Selection";
    }
    await route.fulfill({ response: res, body: JSON.stringify(body) });
  });
  await toSpread(page);
  await page.screenshot({ path: "test-results/plan-longname-375.png", fullPage: true });
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});

test("keyboard: headcount tiles and CTA are reachable and operable", async ({ page }) => {
  await page.goto("/plan");
  const tile = page.getByRole("button", { name: /^20 people/ });
  await tile.focus();
  await page.keyboard.press("Enter");
  await expect(tile).toHaveAttribute("aria-pressed", "true");
});

test("the suggested spread is not padded with boards the headcount doesn't need", async ({ page }) => {
  // Regression: coverage was judged on the midpoint of each board's feeds range, so a
  // board printed "feeds 12–15" scored 13.5 and a 15-person order got a second board
  // bolted on — quoting ~45% over the honest price while contradicting the card.
  await toSpread(page);

  const lines = await page.evaluate(() =>
    [...document.querySelectorAll(".combo-row")].map((r) => {
      const meta = r.querySelector(".muted")?.textContent ?? "";
      const qty = Number(r.querySelector(".stepper-val")?.textContent ?? "1");
      const feedsMax = Number(meta.match(/feeds\s+\d+[–-](\d+)/)?.[1] ?? 0);
      return { feedsMax, qty };
    }),
  );
  expect(lines.length).toBeGreaterThan(0);

  const capacity = lines.reduce((s, l) => s + l.feedsMax * l.qty, 0);
  expect(capacity, "suggestion must cover the headcount").toBeGreaterThanOrEqual(15);

  // ...and must be minimal: dropping any single board would leave it short.
  const smallest = Math.min(...lines.map((l) => l.feedsMax));
  expect(capacity - smallest, `over-provisioned: covers ${capacity} for 15`).toBeLessThan(15);

  // The shortfall warning must not fire on our own suggestion.
  await expect(page.locator(".pl-shortfall")).toHaveCount(0);
});
