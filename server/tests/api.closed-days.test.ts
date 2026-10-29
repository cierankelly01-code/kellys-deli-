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
});
