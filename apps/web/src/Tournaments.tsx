import { useEffect, useState } from "react";
import {
  listTournaments,
  readTournament,
  createTournament,
  sendTournament,
} from "@mench/game-client";
import type {
  PublicTournament,
  TournamentListing,
  TournamentIntent,
} from "@mench/game-protocol";
import type { Messages } from "./messages";
export function Tournaments({ t, userId }: { t: Messages; userId: string }) {
  const [list, setList] = useState<TournamentListing>({ tournaments: [] });
  const [current, setCurrent] = useState<PublicTournament | null>(null);
  const [id, setId] = useState(
    () =>
      location.pathname.match(/^\/tournament\/([a-f0-9-]{36})$/i)?.[1] ?? "",
  );
  const [capacity, setCapacity] = useState<4 | 8 | 16 | 32>(4);
  const [code, setCode] = useState("");
  const [matchId, setMatchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const error = (e: unknown) =>
    setNotice(
      t.errors[e instanceof Error ? e.message : "REQUEST_FAILED"] ?? t.error,
    );
  useEffect(() => {
    void listTournaments()
      .then(setList)
      .catch(() => setNotice(t.error));
  }, [t.error]);
  useEffect(() => {
    if (!current || current.phase !== "running") return;
    const timer = setInterval(() => {
      void readTournament({}, current.id)
        .then(setCurrent)
        .catch(() => setNotice(t.error));
    }, 5000);
    return () => clearInterval(timer);
  }, [current?.id, current?.phase, t.error]);
  async function action(intent?: TournamentIntent, create = false) {
    setBusy(true);
    setNotice("");
    try {
      const result = create
        ? await createTournament({}, capacity)
        : intent && current
          ? await sendTournament({}, current.id, intent)
          : await readTournament({}, id);
      setCurrent(result);
      setId(result.id);
      setList(await listTournaments());
    } catch (e) {
      error(e);
    } finally {
      setBusy(false);
    }
  }
  const name = (player: string | null) =>
    current?.profiles.find((p) => p.id === player)?.name ?? t.waiting;
  const ready =
    current?.rounds
      .flat()
      .filter(
        (m) =>
          m.players.includes(userId) &&
          m.players.every(Boolean) &&
          !m.winner &&
          !m.gameId,
      ) ?? [];
  return (
    <section>
      <h2>{t.tournament}</h2>
      <label>
        {t.players}
        <select
          aria-label={t.tournament + " · " + t.players}
          value={capacity}
          onChange={(e) =>
            setCapacity(Number(e.target.value) as typeof capacity)
          }
        >
          {[4, 8, 16, 32].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <button disabled={busy} onClick={() => void action(undefined, true)}>
        {t.createTournament}
      </button>
      <label>
        {t.tournamentId}
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          maxLength={36}
          dir="ltr"
        />
      </label>
      <button disabled={busy || !id} onClick={() => void action()}>
        {t.view} · {t.tournament}
      </button>
      <ul>
        {list.tournaments.map((item) => (
          <li key={item.id}>
            <button
              disabled={busy}
              onClick={() => {
                setId(item.id);
                void readTournament({}, item.id).then(setCurrent).catch(error);
              }}
            >
              {item.capacity} · {t[item.phase]} · {item.id.slice(0, 8)}
            </button>
          </li>
        ))}
      </ul>
      {current && (
        <>
          <p>
            {current.players.length}/{current.capacity} · {t[current.phase]}
          </p>
          <p dir="ltr">{current.id}</p>
          <button disabled={busy} onClick={() => void action()}>
            {t.refresh} · {t.tournament}
          </button>
          {current.phase === "lobby" && (
            <div className="actions">
              {!current.players.includes(userId) && (
                <button
                  disabled={busy}
                  onClick={() => void action({ type: "join" })}
                >
                  {t.join}
                </button>
              )}
              {current.players.includes(userId) && current.owner !== userId && (
                <button
                  disabled={busy}
                  onClick={() => void action({ type: "leave" })}
                >
                  {t.leave}
                </button>
              )}
              {current.owner === userId && (
                <>
                  <button
                    disabled={
                      busy || current.players.length !== current.capacity
                    }
                    onClick={() => void action({ type: "start" })}
                  >
                    {t.start}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void action({ type: "cancel" })}
                  >
                    {t.cancel}
                  </button>
                </>
              )}
            </div>
          )}
          <p>{current.players.map(name).join(" · ")}</p>
          {current.rounds.map((matches, r) => (
            <div key={r}>
              <h3>
                {t.round} {r + 1}
              </h3>
              <ul>
                {matches.map((m) => (
                  <li key={m.id}>
                    {name(m.players[0])} × {name(m.players[1])}
                    {m.winner && (
                      <>
                        {" "}
                        · {t.winner}: {name(m.winner)}
                      </>
                    )}
                    {m.roomCode && !m.winner && (
                      <a href={`/join/${m.roomCode}`}>
                        {" "}
                        · {t.join}: {m.roomCode}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {ready.length > 0 && (
            <>
              <p className="fine">{t.tournamentHint}</p>
              <label>
                {t.match}
                <select
                  aria-label={t.match}
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                >
                  <option value="">{t.waiting}</option>
                  {ready.map((m) => (
                    <option key={m.id} value={m.id}>
                      {name(m.players[0])} × {name(m.players[1])}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.code}
                <input
                  aria-label={t.tournament + " · " + t.code}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={10}
                />
              </label>
              <button
                disabled={busy || !matchId || code.length !== 10}
                onClick={() => void action({ type: "link", matchId, code })}
              >
                {t.linkMatch}
              </button>
            </>
          )}
          {current.winner && (
            <strong>
              {t.winner}: {name(current.winner)}
            </strong>
          )}
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
