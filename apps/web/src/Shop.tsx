import { useEffect, useRef, useState } from "react";
import {
  BOT_WIN_COINS,
  BOT_WIN_DAILY_LIMIT,
  DAILY_COINS,
  WIN_COINS,
  WIN_DAILY_LIMIT,
  type BoardThemeId,
  type DiceSkinId,
  type PawnSetId,
} from "@mench/board-geometry";
import { Dice } from "./Dice";
import type { Locale } from "@mench/shared-types";
import type { Messages } from "./messages";
import { TopBar } from "./GameScreen";
import { boardArt, pawnArt } from "./Board";
import type { Wallet } from "./coins";

export function CoinChip({
  t,
  coins,
  onClick,
}: {
  t: Messages;
  coins: number | null;
  onClick: () => void;
}) {
  return (
    <button
      className="coin-chip"
      aria-label={`${t.shop} · ${coins ?? 0} ${t.coins}`}
      onClick={onClick}
    >
      <span className="coin" aria-hidden="true" />
      <strong>{coins ?? "…"}</strong>
    </button>
  );
}

/** Once a day on the home screen: collect the free coins. */
export function DailyDialog({ t, wallet }: { t: Messages; wallet: Wallet }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const open = Boolean(wallet.wallet?.dailyAvailable) && !dismissed;
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet daily"
      aria-label={t.dailyTitle}
      onClose={() => setDismissed(true)}
    >
      <div className="daily-coin" aria-hidden="true">
        <span className="coin" />
      </div>
      <h2>{t.dailyTitle}</h2>
      <p>
        {t.dailyBody.replace(
          "{n}",
          String(wallet.wallet?.daily ?? DAILY_COINS),
        )}
      </p>
      <button
        className="primary"
        disabled={wallet.busy}
        onClick={() => void wallet.claim().then(() => setDismissed(true))}
      >
        {t.collect} +{wallet.wallet?.daily ?? DAILY_COINS}
      </button>
      <button className="secondary" onClick={() => setDismissed(true)}>
        {t.later}
      </button>
    </dialog>
  );
}

/** Every way to earn coins. The website has no ads; the apps do. */
export function FreeCoins({
  t,
  wallet,
  onBack,
}: {
  t: Messages;
  wallet: Wallet;
  onBack: () => void;
}) {
  const w = wallet.wallet;
  return (
    <div className="game-screen scrollable free-coins">
      <TopBar t={t} title={t.freeCoins} onBack={onBack} />
      <div className="balance">
        <small>{t.yourCoins}</small>
        <strong>
          <span className="coin" aria-hidden="true" /> {w?.coins ?? "…"}
        </strong>
      </div>
      {!w && <p className="notification">{t.shopOffline}</p>}
      <section className="free-card">
        <h3>📺 {t.adCardTitle}</h3>
        <p>{t.adsUnavailable}</p>
      </section>
      <section className="free-card">
        <h3>📅 {t.dailyCardTitle}</h3>
        <p>{t.dailyCardBody.replace("{n}", String(w?.daily ?? DAILY_COINS))}</p>
        {w?.dailyAvailable ? (
          <button
            className="primary"
            disabled={wallet.busy}
            onClick={() => void wallet.claim()}
          >
            {t.collect} +{w.daily}
          </button>
        ) : w ? (
          <p className="taken">{t.dailyTaken}</p>
        ) : null}
      </section>
      <section className="free-card">
        <h3>🏆 {t.winsCardTitle}</h3>
        <p>{t.winsCardBody}</p>
        <div className="pills">
          <div>
            <strong>{t.coinsN.replace("{n}", String(WIN_COINS))}</strong>
            {t.winOnlineLine.replace("{n}", String(WIN_DAILY_LIMIT))}
          </div>
          <div>
            <strong>{t.coinsN.replace("{n}", String(BOT_WIN_COINS))}</strong>
            {t.winBotLine.replace("{n}", String(BOT_WIN_DAILY_LIMIT))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function Shop({
  t,
  locale,
  wallet,
  onBack,
}: {
  t: Messages;
  locale: Locale;
  wallet: Wallet;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"board" | "pawns" | "dice">("board");
  const [notice, setNotice] = useState("");
  const w = wallet.wallet;
  const items = (w?.catalog ?? []).filter((i) => i.kind === tab);
  return (
    <div className="game-screen shop">
      <TopBar
        t={t}
        title={t.shop}
        onBack={onBack}
        actions={<CoinChip t={t} coins={w?.coins ?? null} onClick={() => {}} />}
      />
      <div className="shop-tabs" role="tablist">
        {(["board", "pawns", "dice"] as const).map((kind) => (
          <button
            key={kind}
            role="tab"
            aria-selected={tab === kind}
            className={tab === kind ? "selected" : ""}
            onClick={() => setTab(kind)}
          >
            {kind === "board"
              ? t.boardsTab
              : kind === "pawns"
                ? t.pawnsTab
                : t.diceTab}
          </button>
        ))}
      </div>
      {!w && <p className="notification">{t.shopOffline}</p>}
      {notice && (
        <p className="notification" role="status">
          {notice}
        </p>
      )}
      <div className="shop-grid">
        {items.map((item) => {
          const owned = w?.owned.includes(item.sku) ?? false;
          const inUse = w?.equipped[item.kind] === item.id;
          return (
            <article
              key={item.sku}
              className={inUse ? "shop-item in-use" : "shop-item"}
            >
              {item.kind === "board" ? (
                <img
                  src={boardArt(item.id as BoardThemeId)}
                  alt=""
                  className="shop-board"
                />
              ) : item.kind === "pawns" ? (
                <div className="shop-pawns">
                  {pawnArt(item.id as PawnSetId).map((src, seat) => (
                    <img key={seat} src={src} alt="" />
                  ))}
                </div>
              ) : (
                <div className="shop-dice" aria-hidden="true">
                  <Dice value={5} skin={item.id as DiceSkinId} />
                </div>
              )}
              <h3>{item.name[locale]}</h3>
              {inUse ? (
                <span className="in-use-label">✓ {t.inUse}</span>
              ) : owned ? (
                <button
                  className="secondary"
                  disabled={wallet.busy}
                  onClick={() => void wallet.equip(item.sku)}
                >
                  {t.use}
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={wallet.busy || !w}
                  aria-label={`${t.buy} ${item.name[locale]} ${item.price} ${t.coins}`}
                  onClick={() => {
                    if (w && w.coins < item.price) {
                      setNotice(t.notEnough);
                      return;
                    }
                    void wallet
                      .buy(item.sku)
                      .then((ok) => setNotice(ok ? t.bought : t.notEnough));
                  }}
                >
                  <span className="coin" aria-hidden="true" /> {item.price}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
