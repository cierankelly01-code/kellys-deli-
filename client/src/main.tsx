import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { inject } from "@vercel/analytics";
import App from "./App";
import "./styles/theme.css";
import "./styles/components.css";
import "./styles/admin.css";

inject(); // Vercel Web Analytics — no-op until enabled on the Vercel project

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
