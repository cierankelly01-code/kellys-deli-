// Single-project Vercel deploy: this function serves the whole API at /api/*.
// The static client (client/dist) is served by Vercel's CDN; the root vercel.json rewrite
// sends every /api/(.*) request here — Express reads the original req.url to route internally.
// Local dev still uses server/src/index.ts.
import { createApp } from "../server/src/app";

export default createApp();
