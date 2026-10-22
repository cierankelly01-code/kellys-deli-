import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies /api to the Express server so the client can call
// same-origin "/api/..." paths in both dev and prod.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Explicit host: on some Windows setups Node's default "localhost" bind resolves to
    // IPv6 only ([::1]), so a browser that tries 127.0.0.1 for "localhost" gets nothing.
    // Binding 0.0.0.0 guarantees the IPv4 address actually works.
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
