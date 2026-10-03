import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { Locale } from "@mench/shared-types";
import { messages } from "./messages";
import { Online } from "./Online";
import { Practice } from "./Practice";
import "./style.css";
function App() {
  const [locale, setLocale] = useState<Locale>("fa");
  const t = messages[locale];
  const [mode, setMode] = useState(
    location.pathname.startsWith("/join/") ? "online" : "practice",
  );
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
      <nav className="tabs">
        <button
          className={mode === "practice" ? "active" : ""}
          onClick={() => setMode("practice")}
        >
          {t.practice}
        </button>
        <button
          className={mode === "online" ? "active" : ""}
          onClick={() => setMode("online")}
        >
          {t.online}
        </button>
      </nav>
      {mode === "practice" ? <Practice t={t} /> : <Online t={t} />}
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
