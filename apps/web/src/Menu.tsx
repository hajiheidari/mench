import { useState } from "react";
import type { Messages } from "./messages";
import { saveName, savedName } from "./nickname";

/** Home menu: display name, language, how to play, privacy and support. */
export function Menu({
  t,
  rtl,
  onLanguage,
}: {
  t: Messages;
  rtl: boolean;
  onLanguage: () => void;
}) {
  const [name, setName] = useState(() => savedName(""));
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
