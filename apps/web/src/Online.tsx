import { useEffect, useState } from "react";
import { currentPlayer, FINISH } from "@mench/game-engine";
import { clientNonce, verifyProof } from "@mench/fair-dice/browser";
import type { DiceProof } from "@mench/fair-dice";
import type { Messages } from "./messages";
import { useOnline } from "./useOnline";
import { GameScreen, TopBar } from "./GameScreen";
import { ResultDialog } from "./ResultDialog";
import { Board } from "./Board";
import { EDGE } from "./backend";
export function Online({ t, onBack }: { t: Messages; onBack: () => void }) {
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
      <div className="game-screen">
        <TopBar t={t} title={t.online} onBack={onBack} />
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
            {!EDGE && (
              <label>
                <input
                  type="checkbox"
                  checked={ranked}
                  disabled={queued || busy}
                  onChange={(e) => setRanked(e.target.checked)}
                />
                {t.ranked}
              </label>
            )}
            {ranked && <p className="fine">{t.rankedHint}</p>}
            {queued && <p role="status">{t.queue}</p>}
          </div>
        </section>
      </div>
    );
  const state = room.state;
  const invite = async () => {
    const url = new URL(`/join/${room.code}`, location.origin).href;
    if (navigator.share && matchMedia("(pointer: coarse)").matches)
      try {
        await navigator.share({ title: t.brand, text: t.inviteText, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    try {
      await navigator.clipboard.writeText(url);
      setNotice(t.copied);
    } catch {
      setNotice(url);
    }
  };
  if (!state)
    return (
      <div className="game-screen">
        <TopBar t={t} title={t.online} onBack={leave} />
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
      </div>
    );
  const mine = currentPlayer(state).id === playerId && connected && !busy;
  // Guests often keep the default nickname; colour and "(you)" keep players apart.
  const label = (id: string | undefined) => {
    const index = room.players.findIndex((p) => p.id === id);
    const player = room.players[index];
    if (!player) return "";
    const seat = state.players[index]!.seat;
    return `${t.names[seat]} · ${player.name}${id === playerId ? ` (${t.you})` : ""}`;
  };
  const active = room.players.find(
    (p) => p.id === (state.winner ?? currentPlayer(state).id),
  );
  const seconds = room.deadline
    ? Math.max(0, Math.ceil((room.deadline - now) / 1000))
    : 0;
  return (
    <GameScreen
      t={t}
      title={t.online}
      onBack={() => {
        leave();
        onBack();
      }}
      actions={
        <button
          className="icon-btn"
          aria-label={`${t.history} (${room.proofs.length})`}
          onClick={() =>
            (
              document.getElementById(
                "dice-history",
              ) as HTMLDialogElement | null
            )?.showModal()
          }
        >
          <span aria-hidden="true">🎲</span>
        </button>
      }
      board={
        <Board
          state={state}
          t={t}
          interactive={mine}
          onMove={(pawn) =>
            void send({ type: "move", pawn, expectedVersion: state.version })
          }
        />
      }
      players={room.players.map((p, index) => ({
        key: p.id,
        seat: state.players[index]!.seat,
        name: `${p.name}${p.id === playerId ? ` (${t.you})` : ""}`,
        finished: state.players[index]!.pawns.filter((n) => n === FINISH)
          .length,
        current: p.id === active?.id && state.phase !== "finished",
      }))}
      dice={state.dice ?? room.proofs.at(-1)?.value ?? null}
      status={
        mine && state.phase === "move"
          ? t.move
          : `${state.winner ? t.winner : t.turn}: ${label(active?.id)}`
      }
      info={
        <>
          {connection}
          {!state.winner && (
            <span className="timer">
              {seconds} {t.seconds}
            </span>
          )}
          {errorView}
          {notice && (
            <span className="notification" role="status">
              {notice}
            </span>
          )}
        </>
      }
      rollDisabled={!mine || state.phase !== "roll" || !room.commitment}
      onRoll={() => {
        const nonce = clientNonce();
        online.nonces.current.set(room.commitment!.hash, nonce);
        void send({ type: "roll", nonce, expectedVersion: state.version });
      }}
    >
      {state.phase === "finished" && active && (
        <ResultDialog
          key={room.matchId ?? room.code}
          t={t}
          winnerName={label(active.id)}
          won={state.winner === playerId}
        />
      )}
      <dialog id="dice-history" className="sheet" aria-label={t.history}>
        <h2>
          {t.history} ({room.proofs.length})
        </h2>
        <div className="history">
          {room.proofs.map((p) => (
            <div className="history-item" key={p.context.roll}>
              #{p.context.roll + 1} · {p.value}
              <button className="secondary" onClick={() => void verify(p)}>
                {t.verify}
              </button>
              <code>{p.commitment.slice(0, 16)}…</code>
            </div>
          ))}
        </div>
        {notice && <p className="notification">{notice}</p>}
        <button
          className="primary"
          onClick={() =>
            (
              document.getElementById(
                "dice-history",
              ) as HTMLDialogElement | null
            )?.close()
          }
        >
          {t.close}
        </button>
      </dialog>
    </GameScreen>
  );
}
