import { useEffect, useState } from "react";
import { readHistory, readTranscript } from "@mench/game-client";
import {
  verifyTranscriptConsistency,
  type GameHistory,
  type GameTranscript,
} from "@mench/game-protocol";
import type { Messages } from "./messages";
export function History({ t }: { t: Messages }) {
  const [data, setData] = useState<GameHistory | null>(null);
  const [transcript, setTranscript] = useState<GameTranscript | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void readHistory()
      .then(setData)
      .catch(() => setStatus(t.error));
  }, [t.error]);
  async function inspect(id: string) {
    setBusy(true);
    setTranscript(null);
    try {
      const value = await readTranscript(id);
      setTranscript(value);
      setStatus(
        verifyTranscriptConsistency(value)
          ? t.replayConsistent
          : t.replayInvalid,
      );
    } catch {
      setStatus(t.error);
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!transcript) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(transcript, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "mench-replay.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section>
      <h2>{t.gameHistory}</h2>
      <p>{t.archiveHint}</p>
      <button
        className="secondary"
        disabled={busy}
        onClick={() =>
          void readHistory()
            .then(setData)
            .catch(() => setStatus(t.error))
        }
      >
        {t.refresh} · {t.gameHistory}
      </button>
      {data?.games.length === 0 && <p>{t.noGames}</p>}
      <ul>
        {data?.games.map((game) => (
          <li key={game.id}>
            {game.players.map((p) => p.name).join(" · ")} ·{" "}
            {new Date(game.createdAt).toLocaleDateString()} ·{" "}
            {game.won ? t.wins : t.finished}{" "}
            <button
              disabled={busy || !game.replayAvailable}
              onClick={() => void inspect(game.id)}
            >
              {t.replayCheck}
            </button>
          </li>
        ))}
      </ul>
      {status && <p role="status">{status}</p>}
      {transcript && (
        <button className="secondary" onClick={download}>
          {t.downloadReplay}
        </button>
      )}
    </section>
  );
}
