import { useEffect, useState } from "react";
import { readRankings } from "@mench/game-client";
import type { Messages } from "./messages";
export function Rankings({ t }: { t: Messages }) {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof readRankings>
  > | null>(null);
  const [error, setError] = useState(false);
  const refresh = () => {
    setError(false);
    void readRankings()
      .then(setData)
      .catch(() => setError(true));
  };
  useEffect(() => {
    void readRankings()
      .then(setData)
      .catch(() => setError(true));
  }, []);
  return (
    <section>
      <h2>{t.ranking}</h2>
      <p>{t.rankedHint}</p>
      {data && (
        <p>
          {t.rating}: {data.self.rating} · {t.games}: {data.self.games} ·{" "}
          {t.wins}: {data.self.wins}
        </p>
      )}
      <button className="secondary" onClick={refresh}>
        {t.refresh} · {t.ranking}
      </button>
      {data && (
        <ol>
          {data.leaderboard.players.map((p) => (
            <li key={p.id}>
              {p.name} · {p.rating}
            </li>
          ))}
        </ol>
      )}
      {error && <p role="status">{t.error}</p>}
    </section>
  );
}
