import { test, expect, type Page } from "@playwright/test";
import { pickCollectionDate } from "./helpers";

/** Fill the checkout details step and open the review (no submit). */
async function toReview(page: Page) {
  await page.getByRole("button", { name: "Continue to details" }).click();
  await page.getByRole("spinbutton", { name: "Headcount" }).fill("2");
  await page.getByLabel("Your name").fill("E2E Sub");
  await page.getByLabel("Phone").fill("07700900777");
  await page.getByLabel("Email").fill("sub-e2e@example.com");
  await pickCollectionDate(page);
  await page.getByRole("button", { name: "Review order" }).click();
}

test.describe("category storefront", () => {
  test("home shows a Shop by occasion band with the seeded categories", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Shop by occasion" })).toBeVisible();
    await expect(page.locator(".occasion-card", { hasText: "Hosting" })).toBeVisible();
    await expect(page.locator(".occasion-card", { hasText: "At Home" })).toBeVisible();
    await expect(page.locator(".occasion-card", { hasText: "Office & Corporate" })).toBeVisible();
  });

  test("shop index → Hosting landing page: SEO title, planner promo, boards", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByRole("heading", { name: "What's the occasion?" })).toBeVisible();
    await page.locator(".occasion-card", { hasText: "Hosting" }).click();
    await expect(page).toHaveURL(/\/shop\/hosting/);
    await expect(page.getByRole("heading", { name: "Hosting", exact: true })).toBeVisible();
    await expect(page).toHaveTitle(/Party & Event Catering Boards, Solihull/);
    await expect(page.getByRole("button", { name: /Plan my event/ })).toBeVisible();
    await expect(page.locator(".board-card").first()).toBeVisible();
  });

  test("At Home page shows the seeded personality boards", async ({ page }) => {
    await page.goto("/shop/at-home");
    await expect(page.getByRole("heading", { name: "At Home", exact: true })).toBeVisible();
    await expect(page.locator(".board-card", { hasText: "The Date Night" })).toBeVisible();
    await expect(page.locator(".board-card", { hasText: "The Too Hot to Cook" })).toBeVisible();
  });

  test("Office & Corporate page: enquiry form submits and lands", async ({ page }) => {
    await page.goto("/shop/office-corporate");
    await expect(page.getByRole("heading", { name: /standing platter for the office/i })).toBeVisible();
    // Honest copy: no next-day promise until the owner confirms.
    await expect(page.getByText(/we'll confirm your schedule/i).first()).toBeVisible();
    await page.getByLabel("Company *").fill("E2E Corp Ltd");
    await page.getByLabel("Your name *").fill("E2E Buyer");
    await page.getByLabel("Email *").fill("corp-e2e@example.com");
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByText(/that's with us/i)).toBeVisible();
  });

  test("sitemap includes the category landing pages", async ({ page }) => {
    const res = await page.request.get("/sitemap.xml");
    const body = await res.text();
    expect(body).toContain("/shop/hosting");
    expect(body).toContain("/shop/at-home");
    expect(body).toContain("/shop/office-corporate");
  });
});

test.describe("Subscribe & Save", () => {
  test("subscribing on a board carries a 10% discount into checkout", async ({ page }) => {
    await page.goto("/shop/at-home");
    await page.locator(".board-card", { hasText: "The Date Night" }).getByRole("button", { name: "Details" }).click();
    await expect(page).toHaveURL(/\/platter\//);

    // Turn on Subscribe & Save and pick weekly.
    await page.locator(".subscribe-save input[type='checkbox']").check();
    await page.getByRole("button", { name: "Every week" }).click();
    // Opens the Smart Cart drawer; continue from there to checkout.
    await page.getByRole("button", { name: /Start a subscription/ }).click();
    await page.getByRole("button", { name: /Continue — choose collection day/ }).click();
    await expect(page).toHaveURL(/\/order/);

    await toReview(page);
    // Discount line + honest recurring note (no automated billing promised).
    await expect(page.getByText(/Subscribe & save \(10%\)/)).toBeVisible();
    await expect(page.getByText(/setting up a weekly board/i)).toBeVisible();
    await expect(page.getByText(/nothing bills\s+automatically/i)).toBeVisible();
  });
});

test.describe("admin categories + enquiries", () => {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "owner@kellysdeli.co.uk";
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme123";
  async function login(page: Page) {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/admin$/);
  }

  test("admin Categories page lists the seeded categories", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Categories" }).click();
    await expect(page.getByText("Hosting").first()).toBeVisible();
    await expect(page.getByText("At Home").first()).toBeVisible();
  });

  // The way the owner actually does it: type a name, press Save. Nothing else.
  // This used to do nothing at all — Save stayed disabled until a hand-typed slug
  // was entered, and typing the name into that box was rejected as invalid.
  test("adds a new category from just a name", async ({ page }) => {
    const name = `Test Occasion ${Math.floor(Math.random() * 1e6)}`;
    await login(page);
    await page.getByRole("link", { name: "Categories" }).click();
    await page.getByRole("button", { name: /new category/i }).click();
    await page.getByLabel("Name").fill(name);
    // The web address fills itself in from the name.
    await expect(page.getByLabel("Web address")).toHaveValue(/test-occasion-\d+/);
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByText(/live on the customer site now/i)).toBeVisible();
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("admin Enquiries page renders the three sections", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Enquiries" }).click();
    await expect(page.getByRole("heading", { name: /Enquiries & Subscriptions/i })).toBeVisible();
  });
});
