import { DemoBoard } from "./DemoBoard";
import React, { useEffect, useState } from "react";
import { readEconomy } from "@mench/game-client";
import { createRoot } from "react-dom/client";
import type { Locale } from "@mench/shared-types";
import { messages } from "./messages";
import { Account } from "./Account";
import { Online } from "./Online";
import { Practice } from "./Practice";
import { RandomMatch } from "./RandomMatch";
import { LanguageToggle, TopBar } from "./GameScreen";
import { EDGE } from "./backend";
import "./style.css";
function initialLocale(): Locale {
  const asked = new URLSearchParams(location.search).get("lang");
  if (asked === "fa" || asked === "en") return asked;
  return "fa";
}
function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const t = messages[locale];
  const [mode, setMode] = useState(
    location.pathname.startsWith("/join/")
      ? "online"
      : !EDGE && location.pathname.startsWith("/tournament/")
        ? "account"
        : "home",
  );
  const home = () => {
    setMode("home");
    // An invite link opens the friends screen once; afterwards "/" is home.
    if (location.pathname !== "/")
      history.replaceState(null, "", "/" + location.search);
  };
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
  }, [locale]);
  useEffect(() => {
    if (EDGE) return;
    void readEconomy()
      .then((data) => {
        document.documentElement.dataset.theme = data.active ?? "";
      })
      .catch(() => {
        document.documentElement.dataset.theme = "";
      });
  }, []);
  const languageButton = (
    <button
      className="language"
      onClick={() => setLocale(locale === "fa" ? "en" : "fa")}
    >
      {t.language}
    </button>
  );
  return (
    <LanguageToggle.Provider
      value={{
        label: t.language,
        toggle: () => setLocale(locale === "fa" ? "en" : "fa"),
      }}
    >
      <main
        dir={locale === "fa" ? "rtl" : "ltr"}
        lang={locale}
        className={mode === "home" ? "home" : "playing"}
      >
        {mode === "home" ? (
          <>
            <header>
              <div>
                <h1>
                  {t.brand}
                  <span className="brand-dot">✦</span>
                </h1>
                <p>{t.tagline}</p>
              </div>
              {languageButton}
            </header>
            <nav className="modes">
              <button
                className="mode random"
                aria-label={t.random}
                onClick={() => setMode("random")}
              >
                <span className="mode-icon" aria-hidden="true">
                  🌍
                </span>
                <strong>{t.random}</strong>
                <small>{t.randomHint}</small>
              </button>
              <button
                className="mode friends"
                aria-label={t.online}
                onClick={() => setMode("online")}
              >
                <span className="mode-icon" aria-hidden="true">
                  🔗
                </span>
                <strong>{t.online}</strong>
                <small>{t.friendsHint}</small>
              </button>
              <button
                className="mode local"
                aria-label={t.practice}
                onClick={() => setMode("practice")}
              >
                <span className="mode-icon" aria-hidden="true">
                  🎲
                </span>
                <strong>{t.practice}</strong>
                <small>{t.practiceHint}</small>
              </button>
              {!EDGE && (
                <button
                  className="mode"
                  aria-label={t.signIn}
                  onClick={() => setMode("account")}
                >
                  <span className="mode-icon" aria-hidden="true">
                    👤
                  </span>
                  <strong>{t.signIn}</strong>
                </button>
              )}
            </nav>
            <DemoBoard t={t} />
            <footer>{t.rules}</footer>
          </>
        ) : mode === "practice" ? (
          <Practice t={t} onBack={home} />
        ) : mode === "random" ? (
          <RandomMatch t={t} onBack={home} />
        ) : mode === "online" ? (
          <Online t={t} onBack={home} />
        ) : (
          <div className="game-screen scrollable">
            <TopBar t={t} title={t.signIn} onBack={home} />
            <Account t={t} />
          </div>
        )}
      </main>
    </LanguageToggle.Provider>
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
