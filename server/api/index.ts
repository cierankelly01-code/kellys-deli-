// Vercel serverless entry for the API. Vercel routes all requests here (see vercel.json)
// and Express handles the routing. Local dev still uses src/index.ts (a standalone server).
import { createApp } from "../src/app";

export default createApp();
