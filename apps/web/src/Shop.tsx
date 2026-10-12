import { useEffect, useRef, useState } from "react";
import type { BoardThemeId, PawnSetId } from "@mench/board-geometry";
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
      <span aria-hidden="true">🪙</span>
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
        🪙
      </div>
      <h2>{t.dailyTitle}</h2>
      <p>{t.dailyBody.replace("{n}", String(wallet.wallet?.daily ?? 50))}</p>
      <button
        className="primary"
        disabled={wallet.busy}
        onClick={() => void wallet.claim().then(() => setDismissed(true))}
      >
        {t.collect} +{wallet.wallet?.daily ?? 50}
      </button>
      <button className="secondary" onClick={() => setDismissed(true)}>
        {t.later}
      </button>
    </dialog>
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
  const [tab, setTab] = useState<"board" | "pawns">("board");
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
        {(["board", "pawns"] as const).map((kind) => (
          <button
            key={kind}
            role="tab"
            aria-selected={tab === kind}
            className={tab === kind ? "selected" : ""}
            onClick={() => setTab(kind)}
          >
            {kind === "board" ? t.boardsTab : t.pawnsTab}
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
              ) : (
                <div className="shop-pawns">
                  {pawnArt(item.id as PawnSetId).map((src, seat) => (
                    <img key={seat} src={src} alt="" />
                  ))}
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
                  🪙 {item.price}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
