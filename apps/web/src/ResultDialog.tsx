import { useEffect, useId, useRef } from "react";
import type { Messages } from "./messages";
export function ResultDialog({
  t,
  winnerName,
  won,
  reward,
  onPlayAgain,
}: {
  t: Messages;
  winnerName: string;
  won?: boolean | undefined;
  /** "+10 coins for this win", once the wallet confirms it. */
  reward?: string;
  onPlayAgain?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="result-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <span className="result-symbol" aria-hidden="true">
        {won === false ? "✦" : "🏆"}
      </span>
      <h2 id={titleId}>
        {won === true
          ? t.congratulations
          : won === false
            ? t.opponentWon
            : t.gameOver}
      </h2>
      <p id={descriptionId}>
        {t.winner}: <strong>{winnerName}</strong>
      </p>
      {reward ? (
        <p className="result-reward" role="status">
          <span className="coin" aria-hidden="true" /> {reward}
        </p>
      ) : null}
      <div className="result-actions">
        {onPlayAgain && (
          <button className="primary" onClick={onPlayAgain}>
            {t.playAgain}
          </button>
        )}
        <button className="secondary" onClick={() => ref.current?.close()}>
          {t.viewBoard}
        </button>
      </div>
    </dialog>
  );
}
