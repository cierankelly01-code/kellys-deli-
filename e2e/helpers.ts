import { type Page, expect } from "@playwright/test";

/**
 * Order a specific size of a board that is sold in several. The shop lists one tile per
 * product now, so the size is chosen on the product page — this walks that path the way a
 * customer does: tile → "Choose a size" → pick → add.
 */
export async function orderBoardSize(page: Page, tileName: string, sizeLabel: string): Promise<void> {
  await page.locator(".board-card", { hasText: tileName }).getByRole("button", { name: /Choose a size/ }).click();
  await expect(page).toHaveURL(/\/platter\//);
  await page.getByRole("radio", { name: sizeLabel }).check();
  await page.getByRole("button", { name: /^Add & continue/ }).click();
}

/**
 * Pick the first bookable date, paging the calendar forward if the month on show is
 * full. A real customer does exactly this when a month sells out — and the shared
 * test database saturates the current month's capacity after enough runs.
 */
export async function pickCollectionDate(page: Page): Promise<void> {
  for (let month = 0; month < 8; month++) {
    const day = page.locator(".cal-day:not([disabled])").first();
    if ((await day.count()) > 0) {
      await day.click();
      return;
    }
    await page.getByRole("button", { name: "Next month" }).click();
    await page.waitForTimeout(150);
  }
  throw new Error("no bookable date within 8 months");
}
