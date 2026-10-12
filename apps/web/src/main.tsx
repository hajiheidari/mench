import { DemoBoard } from "./DemoBoard";
import { Menu } from "./Menu";
import { pawnArt } from "./Board";
import { Appearance, WalletContext, useWallet } from "./coins";
import { CoinChip, DailyDialog, Shop } from "./Shop";
import type {
  BoardThemeId,
  DiceSkinId,
  PawnSetId,
} from "@mench/board-geometry";
import React, { useEffect, useState } from "react";
import { readEconomy, serverReachable } from "@mench/game-client";
import { createRoot } from "react-dom/client";
import type { Locale } from "@mench/shared-types";
import { messages } from "./messages";
import { Account } from "./Account";
import { Online } from "./Online";
import { Practice } from "./Practice";
import { RandomMatch } from "./RandomMatch";
import { LanguageToggle, TopBar } from "./GameScreen";
import { EDGE, HEALTH_URL } from "./backend";
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
  const wallet = useWallet();
  // Online modes need the network; say so instead of a screen that never connects.
  const [online, setOnline] = useState(() => navigator.onLine);
  const [noInternet, setNoInternet] = useState(false);
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) setNoInternet(false);
    };
    addEventListener("online", update);
    addEventListener("offline", update);
    return () => {
      removeEventListener("online", update);
      removeEventListener("offline", update);
    };
  }, []);
  const [checking, setChecking] = useState(false);
  const openOnline = (next: "random" | "online") => {
    if (!navigator.onLine) {
      setNoInternet(true);
      return;
    }
    if (!HEALTH_URL) {
      setMode(next);
      return;
    }
    // Wi-Fi without internet still reads as online: ask the game server.
    setChecking(true);
    void serverReachable(HEALTH_URL).then((reachable) => {
      setChecking(false);
      setNoInternet(!reachable);
      if (reachable) setMode(next);
    });
  };
  const look = {
    board: (wallet.wallet?.equipped.board ?? "classic") as BoardThemeId,
    pawns: (wallet.wallet?.equipped.pawns ?? "classic") as PawnSetId,
    dice: (wallet.wallet?.equipped.dice ?? "classic") as DiceSkinId,
  };
  const home = () => {
    setMode("home");
    // An invite link opens the friends screen once; afterwards "/" is home.
    if (location.pathname !== "/")
      history.replaceState(null, "", "/" + location.search);
  };
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
    document.title = messages[locale].brand;
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
    <WalletContext.Provider value={wallet.enabled ? wallet : null}>
      <Appearance.Provider value={look}>
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
                      <img
                        className="brand-pawn"
                        src={pawnArt("classic")[0]}
                        alt=""
                      />
                      {t.brand}
                    </h1>
                    <p>{t.tagline}</p>
                  </div>
                  <div className="header-actions">
                    {wallet.enabled && (
                      <CoinChip
                        t={t}
                        coins={wallet.wallet?.coins ?? null}
                        onClick={() => setMode("shop")}
                      />
                    )}
                    {languageButton}
                    <Menu
                      t={t}
                      rtl={locale === "fa"}
                      onLanguage={() =>
                        setLocale(locale === "fa" ? "en" : "fa")
                      }
                      {...(wallet.enabled ? { wallet } : {})}
                    />
                  </div>
                </header>
                <nav className="modes">
                  <button
                    className={online ? "mode random" : "mode random offline"}
                    aria-label={t.random}
                    onClick={() => openOnline("random")}
                  >
                    <span className="mode-icon" aria-hidden="true">
                      🌍
                    </span>
                    <strong>{t.random}</strong>
                    <small>{t.randomHint}</small>
                  </button>
                  <button
                    className={online ? "mode friends" : "mode friends offline"}
                    aria-label={t.online}
                    onClick={() => openOnline("online")}
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
                {checking ? (
                  <p className="notification" role="status">
                    {t.checkingInternet}
                  </p>
                ) : noInternet ? (
                  <p className="notification no-internet" role="alert">
                    {t.noInternet}
                  </p>
                ) : null}
                <DemoBoard t={t} />
                <footer>{t.rules}</footer>
                {wallet.enabled && <DailyDialog t={t} wallet={wallet} />}
              </>
            ) : mode === "practice" ? (
              <Practice t={t} onBack={home} />
            ) : mode === "random" ? (
              <RandomMatch t={t} onBack={home} />
            ) : mode === "online" ? (
              <Online t={t} onBack={home} />
            ) : mode === "shop" ? (
              <Shop t={t} locale={locale} wallet={wallet} onBack={home} />
            ) : (
              <div className="game-screen scrollable">
                <TopBar t={t} title={t.signIn} onBack={home} />
                <Account t={t} />
              </div>
            )}
          </main>
        </LanguageToggle.Provider>
      </Appearance.Provider>
    </WalletContext.Provider>
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
