import { test, expect, type Page, type Route } from "@playwright/test";

// Entire API is mocked: these checks never place an order or modify live data.
const board = { id: "launch-board", name: "Launch board", category: "board", description: "A test spread", fixedPrice: 100, fromPrice: 100, isFixed: true, active: true, items: [], variants: [], serves: "4-6", feedsMin: 4, feedsMax: 6, imageUrl: null };
async function setup(page: Page, withCart = true) {
  await page.addInitScript(({ withCart, id }) => {
    localStorage.clear();
    localStorage.setItem("kd-cookie-notice-dismissed", "1");
    if (withCart) localStorage.setItem("kd-cart", JSON.stringify({ savedAt: Date.now(), cart: { boards: [{ platterId: id, quantity: 1 }], addOns: [], headcount: 6, origin: "direct", subscription: { frequency: "weekly" } } }));
  }, { withCart, id: board.id });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path === "/api/platters") data = [board];
    if (path.startsWith("/api/platters/")) data = board;
    if (path === "/api/categories") data = { subscribeSave: true, subscribeSaveDiscountPct: 10 };
    if (path === "/api/locations") data = [{ id: "bentley", name: "Bentley Heath" }];
    if (path === "/api/deli-videos") data = [{ title: "Our board", productId: board.id, url: "https://example.invalid/board.mp4", poster: "", captions: "" }];
    if (path === "/api/availability") data = { days: [] };
    if (path === "/api/tracking") data = {};
    await route.fulfill({ json: data });
  });
}

test("empty checkout stops before details or order submission", async ({ page }) => {
  await setup(page, false);
  await page.goto("/order");
  await expect(page.getByText("Your order is empty.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to details" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Browse boards" })).toBeVisible();
});

test("subscription drawer total and deposit match checkout", async ({ page }) => {
  await setup(page);
  await page.goto(`/platter/${board.id}`);
  await page.getByRole("button", { name: "Your basket, 1 board", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Your basket" });
  await expect(drawer.getByText("Subscribe & save (10%)")).toBeVisible();
  await expect(drawer.locator(".drawer-foot")).toContainText("£90.00");
  await expect(drawer.locator(".drawer-foot")).toContainText("£22.50");
  await drawer.getByRole("button", { name: /Continue — choose collection day/ }).click();
  await expect(page.locator(".running-total")).toContainText("£90.00");
  await expect(page.locator(".running-total")).toContainText("£22.50");
});

test("video product navigation closes basket even on the same product route", async ({ page }) => {
  await setup(page);
  await page.goto(`/platter/${board.id}`);
  await page.getByRole("button", { name: "Your basket, 1 board", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Your basket" });
  await drawer.getByRole("link", { name: /Shop this board/ }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("late calendar response cannot replace the latest month at Bentley Heath", async ({ page }) => {
  await setup(page);
  const pending: Route[] = [];
  await page.route("**/api/availability?**", (route) => { pending.push(route); });
  await page.goto("/order");
  await expect.poll(() => pending.length).toBe(1);
  await page.getByRole("button", { name: "Continue to details" }).click();
  await expect(page.getByLabel("Collect from")).toHaveValue("bentley");
  await page.getByRole("button", { name: "Next month" }).click();
  await expect.poll(() => pending.length).toBe(2);
  const nextDate = new URL(pending[1].request().url()).searchParams.get("from")!;
  await pending[1].fulfill({ json: { days: [{ date: nextDate, bookable: true, status: "open", remaining: 10 }] } });
  await expect(page.locator(".cal-day:not([disabled])")).toHaveCount(1);
  await pending[0].fulfill({ json: { days: [] } });
  // Flush the old response through React, then confirm the new month's date survived.
  await page.waitForTimeout(150);
  await expect(page.locator(".cal-day:not([disabled])")).toHaveCount(1);
  await page.locator(".cal-day:not([disabled])").click();
  await expect(page.locator(".cal-day.selected")).toHaveCount(1);
});
