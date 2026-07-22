import { type Page } from "@playwright/test";

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
