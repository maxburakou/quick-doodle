import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../index.css";
import "@fontsource/jetbrains-mono/index.css";
import SettingsApp from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsApp />
  </StrictMode>
);
