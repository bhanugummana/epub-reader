import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import EpubReader from "./EpubReader.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EpubReader />
  </StrictMode>
);
