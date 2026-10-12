import { useState } from "react";
import type { Messages } from "./messages";
import { saveName, savedName } from "./nickname";
import type { Wallet } from "./coins";

/** Home menu: display name, language, how to play, privacy and support. */
export function Menu({
  t,
  rtl,
  onLanguage,
  wallet,
}: {
  t: Messages;
  rtl: boolean;
  onLanguage: () => void;
  wallet?: Wallet;
}) {
  const [name, setName] = useState(() => savedName(""));
  const [restoreCode, setRestoreCode] = useState("");
  const [codeNotice, setCodeNotice] = useState("");
  const dialog = () =>
    document.getElementById("menu") as HTMLDialogElement | null;
  return (
    <>
      <button
        className="icon-btn menu-btn"
        aria-label={t.menu}
        onClick={() => {
          setName(savedName(""));
          dialog()?.showModal();
        }}
      >
        <span aria-hidden="true">☰</span>
      </button>
      <dialog id="menu" className="sheet" aria-label={t.menu}>
        <h2>{t.menu}</h2>
        <label>
          {t.nickname}
          <input
            value={name}
            maxLength={24}
            onChange={(e) => {
              setName(e.target.value);
              saveName(e.target.value);
            }}
          />
        </label>
        <p className="fine">{t.nameHint}</p>
        <button className="secondary" onClick={onLanguage}>
          {t.language}
        </button>
        {wallet?.code && (
          <section className="recovery">
            <h2>{t.recoveryTitle}</h2>
            <p className="fine">{t.recoveryHint}</p>
            <output className="recovery-code" dir="ltr">
              {wallet.code}
            </output>
            <button
              className="secondary"
              onClick={() =>
                void navigator.clipboard
                  .writeText(wallet.code!)
                  .then(() => setCodeNotice(t.codeCopied))
                  .catch(() => setCodeNotice(wallet.code!))
              }
            >
              {t.copyCode}
            </button>
            <label>
              {t.restoreLabel}
              <input
                dir="ltr"
                value={restoreCode}
                maxLength={24}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                onChange={(e) => setRestoreCode(e.target.value)}
              />
            </label>
            <button
              className="secondary"
              disabled={wallet.busy || restoreCode.trim().length < 16}
              onClick={() =>
                void wallet.recover(restoreCode).then((ok) => {
                  if (ok) setRestoreCode("");
                  setCodeNotice(ok ? t.restored : "");
                })
              }
            >
              {t.restore}
            </button>
            {(codeNotice ||
              wallet.error === "CODE_NOT_FOUND" ||
              wallet.error === "BAD_CODE") && (
              <p className="notification" role="status">
                {wallet.error === "CODE_NOT_FOUND"
                  ? t.codeNotFound
                  : wallet.error === "BAD_CODE"
                    ? t.badCode
                    : codeNotice}
              </p>
            )}
          </section>
        )}
        <h2>{t.howToPlay}</h2>
        <ol className="how-to">
          {t.howToPlaySteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <a
          className="menu-link"
          href="https://espadna.com/mench-app/privacy/"
          target="_blank"
          rel="noopener"
        >
          {t.privacy}
        </a>
        <a
          className="menu-link"
          href={`https://espadna.com/mench-app/${rtl ? "fa/" : ""}`}
          target="_blank"
          rel="noopener"
        >
          {t.support}
        </a>
        <button className="primary" onClick={() => dialog()?.close()}>
          {t.close}
        </button>
      </dialog>
    </>
  );
}
