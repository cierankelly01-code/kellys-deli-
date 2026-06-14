import { env } from "./lib/env";
import { createApp } from "./app";

const app = createApp();

app.listen(env.port, () => {
  console.log(`Kelly's Deli API listening on http://localhost:${env.port}`);
});
