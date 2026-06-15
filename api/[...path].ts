// Single-project Vercel deploy: this catch-all function serves the whole API at /api/*.
// The static client (client/dist) is served by Vercel's CDN; everything under /api hits
// this Express app. Local dev still uses server/src/index.ts.
import { createApp } from "../server/src/app";

export default createApp();
