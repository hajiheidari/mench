import { useEffect, useState } from "react";
import { currentPlayer, FINISH } from "@mench/game-engine";
import { clientNonce, verifyProof } from "@mench/fair-dice/browser";
import type { DiceProof } from "@mench/fair-dice";
import type { Messages } from "./messages";
import { useOnline } from "./useOnline";
import { Avatar } from "./Avatar";
import { Dice } from "./Dice";
import { ResultDialog } from "./ResultDialog";
import { Board } from "./Board";
export function Online({ t }: { t: Messages }) {
  const online = useOnline();
  const { room, playerId, connected, queued, error, busy, send } = online;
  const [name, setName] = useState(t.guest);
  const [code, setCode] = useState(
    () =>
      location.pathname
        .match(/^\/join\/([A-F0-9]{10})$/i)?.[1]
        ?.toUpperCase() ?? "",
  );
  const [capacity, setCapacity] = useState(2);
  const [ranked, setRanked] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const connection = (
    <div className="connection" role="status">
      <span
        className="player-avatar"
        style={{ background: connected ? "#388872" : "#d3a32d" }}
      />
      {connected ? t.connected : t.reconnecting}
    </div>
  );
  const errorView = error && (
    <p className="error" role="alert">
      {t.error}: {t.errors[error] ?? t.errors.REQUEST_FAILED}
    </p>
  );
  const leave = () => {
    void send({ type: "leave" });
    setNotice("");
  };
  async function verify(proof: DiceProof) {
    const observed = online.commitments.current.get(proof.commitment);
    if (!observed) {
      setNotice(t.unwitnessed);
      return;
    }
    const nonce = online.nonces.current.get(proof.commitment) ?? proof.nonce;
    setNotice(
      (await verifyProof(proof, observed, nonce)) ? t.verified : t.invalidProof,
    );
  }
  if (!room)
    return (
      <section className="lobby">
        <div className="panel">
          {connection}
          <h2>{t.online}</h2>
          {errorView}
          <label>
            {t.nickname}
            <input
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            {t.players}
            <select
              aria-label={t.players}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            >
              <option value="2">{t.two}</option>
              <option value="3">{t.three}</option>
              <option value="4">{t.four}</option>
            </select>
          </label>
          <button
            className="primary"
            disabled={!connected || busy || queued}
            onClick={() => void send({ type: "create", name, capacity })}
          >
            {t.create}
          </button>
          <label>
            {t.code}
            <input
              value={code}
              maxLength={10}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              dir="ltr"
            />
          </label>
          <button
            className="secondary"
            disabled={!connected || busy || queued || code.length !== 10}
            onClick={() => void send({ type: "join", name, code })}
          >
            {t.join}
          </button>
          <button
            className="secondary"
            disabled={!connected || busy}
            onClick={() =>
              void send(
                queued
                  ? { type: "cancelQueue" }
                  : { type: "queue", name, ranked },
              )
            }
          >
            {queued ? t.cancel : t.matchmaking}
          </button>
          <label>
            <input
              type="checkbox"
              checked={ranked}
              disabled={queued || busy}
              onChange={(e) => setRanked(e.target.checked)}
            />
            {t.ranked}
          </label>
          {ranked && <p className="fine">{t.rankedHint}</p>}
          {queued && <p role="status">{t.queue}</p>}
        </div>
      </section>
    );
  const state = room.state;
  const invite = async () => {
    const url = new URL(`/join/${room.code}`, location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setNotice(t.copied);
    } catch {
      setNotice(url);
    }
  };
  if (!state)
    return (
      <section className="lobby">
        <div className="panel">
          {connection}
          <h2>{t.waiting}</h2>
          <div className="room-code" data-testid="room-code">
            {room.code}
          </div>
          {room.ranked && <p>{t.ranked}</p>}
          <div className="players">
            {room.players.map((p) => (
              <div key={p.id} className="player-card">
                <span
                  className="player-avatar"
                  style={{ background: p.connected ? "#388872" : "#d3a32d" }}
                />
                {p.name}
              </div>
            ))}
          </div>
          <button
            className="primary"
            disabled={
              !connected ||
              busy ||
              room.hostId !== playerId ||
              room.players.length !== room.capacity ||
              room.players.some((p) => !p.connected)
            }
            onClick={() => void send({ type: "start" })}
          >
            {t.start}
          </button>
          <button className="secondary" onClick={() => void invite()}>
            {t.copy}
          </button>
          <button className="secondary" onClick={leave}>
            {t.leave}
          </button>
          {notice && <p className="notification">{notice}</p>}
          {errorView}
        </div>
      </section>
    );
  const mine = currentPlayer(state).id === playerId && connected && !busy;
  const active = room.players.find(
    (p) => p.id === (state.winner ?? currentPlayer(state).id),
  );
  return (
    <div className="game-layout">
      {state.phase === "finished" && active && (
        <ResultDialog
          key={room.matchId ?? room.code}
          t={t}
          winnerName={active.name}
          won={state.winner === playerId}
        />
      )}
      <section>
        <Board
          state={state}
          t={t}
          interactive={mine}
          onMove={(pawn) =>
            void send({ type: "move", pawn, expectedVersion: state.version })
          }
        />
        <p className="board-hint">{t.hint}</p>
      </section>
      <aside className="panel game-panel">
        {connection}
        <h2>
          {state.winner ? t.winner : t.turn}: {active?.name}
        </h2>
        <Dice value={state.dice ?? room.proofs.at(-1)?.value ?? null} />
        <span className="timer">
          {room.deadline
            ? Math.max(0, Math.ceil((room.deadline - now) / 1000))
            : 0}{" "}
          {t.seconds}
        </span>
        <button
          className="primary"
          disabled={!mine || state.phase !== "roll" || !room.commitment}
          onClick={() => {
            const nonce = clientNonce();
            online.nonces.current.set(room.commitment!.hash, nonce);
            void send({ type: "roll", nonce, expectedVersion: state.version });
          }}
        >
          {t.roll}
        </button>
        {mine && state.phase === "move" && <p role="status">{t.move}</p>}
        <div className="players">
          {room.players.map((p, index) => (
            <div
              key={p.id}
              className={
                p.id === active?.id ? "player-card current" : "player-card"
              }
            >
              <Avatar seat={state.players[index]!.seat} />
              {p.name}
              <small>
                {state.players[index]!.pawns.filter((n) => n === FINISH).length}
                /4
              </small>
            </div>
          ))}
        </div>
        {errorView}
        {notice && (
          <p className="notification" role="status">
            {notice}
          </p>
        )}
        <button className="secondary" onClick={leave}>
          {t.leave}
        </button>
        <details className="history">
          <summary>
            {t.history} ({room.proofs.length})
          </summary>
          {room.proofs.map((p) => (
            <div className="history-item" key={p.context.roll}>
              #{p.context.roll + 1} · {p.value}
              <button className="secondary" onClick={() => void verify(p)}>
                {t.verify}
              </button>
              <code>{p.commitment.slice(0, 16)}…</code>
            </div>
          ))}
        </details>
      </aside>
    </div>
  );
}
