import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { Locale } from "@mench/shared-types";
import { messages } from "./messages";
import { Practice } from "./Practice";
import "./style.css";
function App() {
  const [locale, setLocale] = useState<Locale>("fa");
  const t = messages[locale];
  return (
    <main dir={locale === "fa" ? "rtl" : "ltr"} lang={locale}>
      <header>
        <div>
          <h1>
            {t.brand}
            <span className="brand-dot">✦</span>
          </h1>
          <p>{t.tagline}</p>
        </div>
        <button
          className="language"
          onClick={() => {
            const next = locale === "fa" ? "en" : "fa";
            setLocale(next);
            document.documentElement.lang = next;
            document.documentElement.dir = next === "fa" ? "rtl" : "ltr";
          }}
        >
          {t.language}
        </button>
      </header>
      <Practice t={t} />
      <footer>
        {t.rules} · {t.practice}
      </footer>
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
