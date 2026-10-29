import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // Empty, not unset: dotenv never overrides a set var, so a Telegram bot in server/.env
    // can't get test orders pinged to the owner's phone.
    env: { TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "" },
  },
});
