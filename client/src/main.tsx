import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/theme.css";
import "./styles/components.css";
import "./styles/admin.css";
import { startMotion } from "./lib/motion";

startMotion();

// (Vercel Web Analytics removed — the app now runs on Coolify/VPS, where the
// injected /_vercel/insights/script.js 404s and errors in the console on every page.)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
