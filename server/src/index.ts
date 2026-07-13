import { env } from "./lib/env";
import { createApp } from "./app";

const app = createApp();

// Bind 0.0.0.0 so the port is reachable from outside the container (VPS/Docker).
app.listen(env.port, "0.0.0.0", () => {
  console.log(`Kelly's Deli server listening on http://0.0.0.0:${env.port}`);
});
