import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { Locale } from "@mench/shared-types";
import { messages } from "./messages";
import "./style.css";
function App() {
  const [locale, setLocale] = useState<Locale>("fa");
  const t = messages[locale];
  return (
    <main dir={locale === "fa" ? "rtl" : "ltr"} lang={locale}>
      <button
        onClick={() => {
          const next = locale === "fa" ? "en" : "fa";
          setLocale(next);
          document.documentElement.lang = next;
          document.documentElement.dir = next === "fa" ? "rtl" : "ltr";
        }}
      >
        {t.language}
      </button>
      <div className="mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <p className="stage">{t.stage}</p>
      <h1>{t.title}</h1>
      <p>{t.subtitle}</p>
    </main>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing app root");
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
