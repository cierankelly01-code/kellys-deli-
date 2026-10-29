import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;
const app = createApp();

/** The next date (YYYY-MM-DD) at least `minDays` ahead that falls on `weekday` (0 = Sunday). */
function nextWeekday(weekday: number, minDays = 60): string {
  const dt = new Date(Date.now() + minDays * 86_400_000);
  while (dt.getUTCDay() !== weekday) dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

// Seeded Bentley Heath hours: closed Monday and Sunday (server/prisma/seed.ts).
d("board collection on closed days", () => {
  it("never offers Sunday or Monday in the calendar, but does offer Tuesday", async () => {
    const sunday = nextWeekday(0);
    const res = await request(app).get(`/api/availability?locationId=loc-bentley-heath&from=${sunday}&days=7`);
    expect(res.status).toBe(200);
    const byDate = Object.fromEntries((res.body.days as Array<{ date: string; bookable: boolean }>).map((x) => [x.date, x.bookable]));
    const monday = new Date(Date.parse(sunday) + 86_400_000).toISOString().slice(0, 10);
    const tuesday = new Date(Date.parse(sunday) + 2 * 86_400_000).toISOString().slice(0, 10);
    expect(byDate[sunday]).toBe(false);
    expect(byDate[monday]).toBe(false);
    expect(byDate[tuesday]).toBe(true);
  });

  it("refuses an order for a day the shop is shut, and says why", async () => {
    const boards = (await request(app).get("/api/platters?category=board")).body as Array<{ id: string; fixedPrice: number | null }>;
    const board = boards.find((b) => b.fixedPrice != null);
    expect(board).toBeTruthy();
    const order = (date: string) =>
      request(app).post("/api/orders").send({
        items: [{ platterId: board!.id, quantity: 1 }],
        headcount: 8,
        collectionOrDeliveryDate: date,
        locationId: "loc-bentley-heath",
        customerName: "Closed Day Test",
        phone: `07${Math.floor(700000000 + Math.random() * 99999999)}`,
        email: "closed-day@example.com",
      });
    for (const date of [nextWeekday(0, 90), nextWeekday(1, 90)]) {
      const res = await order(date);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/closed that day/i);
    }
  });

  it("labels shut days so the calendar can say 'Shop closed'", async () => {
    const sunday = nextWeekday(0);
    const res = await request(app).get(`/api/availability?locationId=loc-bentley-heath&from=${sunday}&days=1`);
    expect(res.body.days[0].reason).toBe("shop_closed");
  });
});

describe("closed-day wording", () => {
  it("only treats a clearly-closed value as closed", async () => {
    const { closedWeekdaysFromHours } = await import("../src/lib/capacity");
    const hours = (v: string) => ({ sun: v, mon: "8-4", tue: "8-4", wed: "8-4", thu: "8-4", fri: "8-4", sat: "8-4" });
    for (const v of ["Closed", "shut", "N/A", "-", "", "not open"]) expect(closedWeekdaysFromHours(hours(v))).toEqual([0]);
    for (const v of ["8:00-16:00 (closed 12-1)", "8am-4pm", "By appointment"]) expect(closedWeekdaysFromHours(hours(v))).toEqual([]);
  });
});
