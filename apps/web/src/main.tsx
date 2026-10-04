import React, { useEffect, useState } from "react";
import { readEconomy } from "@mench/game-client";
import { createRoot } from "react-dom/client";
import type { Locale } from "@mench/shared-types";
import { messages } from "./messages";
import { Account } from "./Account";
import { Online } from "./Online";
import { Practice } from "./Practice";
import "./style.css";
function App() {
  const [locale, setLocale] = useState<Locale>("fa");
  const t = messages[locale];
  const [mode, setMode] = useState(
    location.pathname.startsWith("/join/") ? "online" : "practice",
  );
  useEffect(() => {
    void readEconomy()
      .then((data) => {
        document.documentElement.dataset.theme = data.active ?? "";
      })
      .catch(() => {
        document.documentElement.dataset.theme = "";
      });
  }, []);
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
        <button
          className={mode === "account" ? "active" : ""}
          onClick={() => setMode("account")}
        >
          {t.signIn}
        </button>
      </nav>
      {mode === "practice" ? (
        <Practice t={t} />
      ) : mode === "online" ? (
        <Online t={t} />
      ) : (
        <Account t={t} />
      )}
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

if (import.meta.env.PROD && "serviceWorker" in navigator)
  void navigator.serviceWorker
    .register("/sw.js")
    .catch((error) =>
      console.error("Service worker registration failed", error),
    );
