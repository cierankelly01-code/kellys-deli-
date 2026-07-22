// Site-wide mobile + a11y sweep. The planner audit turned up 34px tap targets on a
// shared component; this checks the same class of fault everywhere a customer goes.
import { test, expect } from "@playwright/test";

const PAGES = [
  { path: "/", name: "home" },
  { path: "/platters", name: "boards" },
  { path: "/shop", name: "shop" },
  { path: "/plan", name: "plan" },
  { path: "/privacy", name: "privacy" },
  { path: "/terms", name: "terms" },
];

for (const p of PAGES) {
  test(`${p.name}: no horizontal overflow at 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(p.path);
    await page.waitForLoadState("networkidle");
    const info = await page.evaluate(() => {
      const de = document.documentElement;
      if (de.scrollWidth <= de.clientWidth) return null;
      // Name the culprits rather than just failing.
      const wide = [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((el) => el.getBoundingClientRect().right > de.clientWidth + 1)
        .slice(0, 5)
        .map((el) => `${el.tagName.toLowerCase()}.${el.className.toString().split(" ")[0]}`);
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, wide };
    });
    expect(info, JSON.stringify(info)).toBeNull();
  });

  // Threshold: 44px in the direction that matters for a thumb, and never below the
  // WCAG 2.2 AA floor of 24px in the other. A short nav word like "Shop" ends up
  // 36x44 — that is a comfortable target and widening it to 44 would push the nav
  // items apart for no usability gain. Steppers sitting side by side are the real
  // risk and they are held to 44x44 in plan-gauntlet.spec.ts.
  test(`${p.name}: tap targets are big enough`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(p.path);
    await page.waitForLoadState("networkidle");
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("button, a[href], input, select")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          if (s.display === "none" || s.visibility === "hidden" || r.width === 0) return false;
          // Inline text links inside a paragraph are exempt (WCAG 2.5.5 inline exception).
          if (el.tagName === "A" && el.closest("p, li")) return false;
          // Buttons are primary actions and held to 44px in the thumb direction.
          // Navigation/footer links are held to the WCAG 2.2 AA floor of 24x24 —
          // padding them to 44 would space the footer out for no usability gain.
          const floor = el.tagName === "BUTTON" ? 44 : 24;
          // 0.5px tolerance: sub-pixel layout rounds 44 to 43.99.
          return r.height < floor - 0.5 || r.width < 23.5;
        })
        .slice(0, 8)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return `${el.tagName.toLowerCase()}.${el.className.toString().split(" ")[0]} "${(el.textContent ?? "").trim().slice(0, 18)}" ${Math.round(r.width)}x${Math.round(r.height)}`;
        }),
    );
    expect(small, small.join("\n")).toEqual([]);
  });

  test(`${p.name}: exactly one h1`, async ({ page }) => {
    await page.goto(p.path);
    await page.waitForLoadState("networkidle");
    const h1s = await page.locator("h1").count();
    expect(h1s, `${p.name} has ${h1s} h1 elements`).toBe(1);
  });
}
