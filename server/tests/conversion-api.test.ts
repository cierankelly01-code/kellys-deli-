import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signToken } from "../src/lib/auth";
import { dispatchOccasionReminders, cancelToken } from "../src/lib/occasion-reminders";

const local = process.env.DATABASE_URL?.includes("localhost:5433");
const suite = local ? describe : describe.skip;
suite("conversion controls (local database only)", () => {
  const app = createApp();
  const auth = { Authorization: `Bearer ${signToken({ id: "test", email: "test@example.com", role: "admin" })}` };
  const ids: string[] = [];
  let oldVideos: string | null = null;
  let oldEnabled: string | null = null;
  beforeAll(async () => {
    oldVideos = (await prisma.setting.findUnique({ where: { key: "deliVideos" } }))?.value ?? null;
    oldEnabled = (await prisma.setting.findUnique({ where: { key: "remindersEnabled" } }))?.value ?? null;
  });
  afterAll(async () => {
    vi.unstubAllEnvs(); vi.unstubAllGlobals();
    await prisma.reminderSignup.deleteMany({ where: { id: { in: ids } } });
    for (const [key, value] of [["deliVideos", oldVideos], ["remindersEnabled", oldEnabled]] as const) {
      if (value === null) await prisma.setting.deleteMany({ where: { key } });
      else await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    }
  });
  it("protects video controls and rejects unsafe URLs", async () => {
    expect((await request(app).patch("/api/admin/settings/deliVideos").send({ value: "[]" })).status).toBe(401);
    expect((await request(app).patch("/api/admin/settings/deliVideos").set(auth).send({ value: JSON.stringify([{ title: "Clip", url: "javascript:alert(1)", poster: "https://example.com/a.jpg", productId: "" }]) })).status).toBe(400);
  });
  it("saves a video configuration larger than the ordinary settings limit", async () => {
    const videos = Array.from({ length: 3 }, (_, i) => ({ title: "A generous board worth sharing ".repeat(2), url: `https://example.com/${i}.mp4`, poster: `https://example.com/${i}.jpg`, captions: "", productId: "" }));
    const saved = await request(app).patch("/api/admin/settings/deliVideos").set(auth).send({ value: JSON.stringify(videos) });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect((await request(app).get("/api/deli-videos")).body).toEqual(videos.map((v) => ({ ...v, title: v.title.trim() })));
  });
  it("does not promise unavailable reminders", async () => {
    vi.stubEnv("REMINDERS_ENABLED", "off");
    expect((await request(app).get("/api/occasion-reminders/status")).body).toEqual({ email: false, sms: false });
  });
  it("dispatches each requested channel at most once and honours cancellation", async () => {
    vi.stubEnv("REMINDERS_ENABLED", "on"); vi.stubEnv("RESEND_API_KEY", "test-only"); vi.stubEnv("EMAIL_FROM", "test@example.com");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "test-only"); vi.stubEnv("TWILIO_AUTH_TOKEN", "test-only"); vi.stubEnv("TWILIO_MESSAGING_SERVICE_SID", "test-only");
    await prisma.setting.upsert({ where: { key: "remindersEnabled" }, create: { key: "remindersEnabled", value: "on" }, update: { value: "on" } });
    const signupEmail = `${randomUUID()}@example.com`;
    const signup = { email: signupEmail, occasion: "A birthday", reminderDate: new Date(Date.now() + 86400000 * 60).toISOString().slice(0, 10), daysBefore: 14, emailConsent: true };
    const signups = await Promise.all([request(app).post("/api/occasion-reminders").send(signup), request(app).post("/api/occasion-reminders").send(signup)]);
    expect(signups.map((r) => r.status).sort()).toEqual([200, 201]);
    const captured = await prisma.reminderSignup.findMany({ where: { email: signupEmail } });
    ids.push(...captured.map((r) => r.id));
    expect(captured).toHaveLength(1);
    const changed = await request(app).post("/api/occasion-reminders").send({ ...signup, daysBefore: 30 });
    expect(changed.status).toBe(409);
    expect(changed.body.cancelPath).toBeUndefined();
    expect((await prisma.reminderSignup.findUniqueOrThrow({ where: { id: captured[0].id } })).dueAt).toEqual(captured[0].dueAt);
    const r = await prisma.reminderSignup.create({ data: { email: `${randomUUID()}@example.com`, phone: "+447700900123", occasion: "A birthday", reminderDate: new Date(Date.now() + 86400000 * 14), dueAt: new Date(Date.now() - 1000), emailConsent: true, smsConsent: true, consentAt: new Date() } });
    ids.push(r.id);
    const send = vi.fn().mockResolvedValue({ ok: true, status: 200 }); vi.stubGlobal("fetch", send);
    await Promise.all([dispatchOccasionReminders(), dispatchOccasionReminders()]);
    expect(send).toHaveBeenCalledTimes(2);
    await dispatchOccasionReminders(); expect(send).toHaveBeenCalledTimes(2);
    const cancel = await request(app).post(`/api/occasion-reminders/cancel/${cancelToken(r.id)}`);
    expect(cancel.status).toBe(200);
    expect((await prisma.reminderSignup.findUniqueOrThrow({ where: { id: r.id } })).cancelled).toBe(true);
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });
  it("does not let an unavailable SMS channel starve due email reminders", async () => {
    vi.stubEnv("REMINDERS_ENABLED", "on"); vi.stubEnv("RESEND_API_KEY", "test-only"); vi.stubEnv("EMAIL_FROM", "test@example.com");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "");
    await prisma.setting.upsert({ where: { key: "remindersEnabled" }, create: { key: "remindersEnabled", value: "on" }, update: { value: "on" } });
    const smsIds = Array.from({ length: 100 }, () => randomUUID()); ids.push(...smsIds);
    await prisma.reminderSignup.createMany({ data: smsIds.map((id) => ({ id, email: "", phone: "+447700900123", occasion: "A birthday", reminderDate: new Date(Date.now() + 86400000 * 14), dueAt: new Date(Date.now() - 20000), emailConsent: false, smsConsent: true, consentAt: new Date() })) });
    const email = await prisma.reminderSignup.create({ data: { email: `${randomUUID()}@example.com`, occasion: "A birthday", reminderDate: new Date(Date.now() + 86400000 * 14), dueAt: new Date(Date.now() - 1000), emailConsent: true, consentAt: new Date() } }); ids.push(email.id);
    const send = vi.fn().mockResolvedValue({ ok: true, status: 200 }); vi.stubGlobal("fetch", send);
    await dispatchOccasionReminders();
    expect(send).toHaveBeenCalledTimes(1);
    expect((await prisma.reminderSignup.findUniqueOrThrow({ where: { id: email.id } })).emailStatus).toBe("accepted");
    expect(await prisma.reminderSignup.count({ where: { id: { in: smsIds }, smsStatus: "pending" } })).toBe(100);
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });
});
