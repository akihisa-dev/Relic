import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@relic-app/renderer/App";
import { installRelicClientProvider } from "@relic-app/renderer/relicClient";
import { tauriRelicClient } from "./tauriRelicClient";

installRelicClientProvider(() => tauriRelicClient);

const root = document.getElementById("root");
if (!root) throw new Error("Root element was not found.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
