// Booking months ahead. The date picker used to show a flat strip of the next 21
// days, so a birthday or Christmas order simply couldn't be placed — there was no
// way to reach the date. It now pages a month at a time.
import { test, expect, type Page } from "@playwright/test";

async function reachDatePicker(page: Page) {
  await page.goto("/platters");
  await page.locator(".gallery-card", { hasText: "Indian Board" }).click();
  await page.getByRole("button", { name: /Add & continue/ }).click();
  // The add opens the Smart Cart drawer; from there (or directly) we land on /order.
  const drawerCont = page.getByRole("button", { name: /Continue — choose collection day/ });
  await Promise.race([
    drawerCont.waitFor({ state: "visible", timeout: 8000 }).then(() => drawerCont.click()),
    page.waitForURL(/\/order/, { timeout: 8000 }),
  ]).catch(() => {});
  await expect(page).toHaveURL(/\/order/);
  // The date picker lives on the details step.
  await page.getByRole("button", { name: "Continue to details" }).click();
  await expect(page.locator(".cal-grid")).toBeVisible();
}

test("the calendar pages forward and a date months ahead can be picked", async ({ page }) => {
  await reachDatePicker(page);

  const monthNow = (await page.locator(".cal-month").textContent())?.trim();
  expect(monthNow).toBeTruthy();

  // Page three months forward.
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(page.locator(".cal-day:not(:disabled)").first()).toBeVisible();
  }
  const monthLater = (await page.locator(".cal-month").textContent())?.trim();
  expect(monthLater).not.toBe(monthNow);

  // A date that far out is bookable (no 48h rule, no capacity pressure).
  const day = page.locator(".cal-day:not(:disabled)").first();
  await day.click();
  await expect(day).toHaveClass(/selected/);
});

test("you cannot page back before this month", async ({ page }) => {
  await reachDatePicker(page);
  await expect(page.getByRole("button", { name: "Previous month" })).toBeDisabled();
});

test("the grid keeps weekday alignment when paging", async ({ page }) => {
  await reachDatePicker(page);
  // 7 weekday headers, always — the month grid must not collapse to a strip.
  await expect(page.locator(".cal-wd")).toHaveCount(7);
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.locator(".cal-wd")).toHaveCount(7);
});

test("calendar renders on a narrow phone without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await reachDatePicker(page);
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
  await page.locator(".cal").screenshot({ path: "test-results/calendar-320.png" });
});
