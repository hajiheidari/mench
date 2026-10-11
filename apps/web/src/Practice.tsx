import { useEffect, useRef, useState } from "react";
import { chooseMove, type Difficulty } from "@mench/game-bot";
import {
  applyAction,
  createGame,
  currentPlayer,
  FINISH,
} from "@mench/game-engine";
import { ResultDialog } from "./ResultDialog";
import { Board, colors } from "./Board";
import { GameScreen, randomDie } from "./GameScreen";
import type { Messages } from "./messages";

export function Practice({ t, onBack }: { t: Messages; onBack: () => void }) {
  const [state, setState] = useState(() => createGame(["0", "1"]));
  const [last, setLast] = useState<number | null>(null);
  const [bots, setBots] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const settings = useRef<HTMLDialogElement>(null);
  const winner = state.players.find((player) => player.id === state.winner);
  const count = state.players.length;
  function newGame(playerCount = count) {
    setState(
      createGame(Array.from({ length: playerCount }, (_, i) => String(i))),
    );
    setLast(null);
  }
  const botTurn =
    bots && state.phase !== "finished" && currentPlayer(state).id !== "0";
  useEffect(() => {
    if (!botTurn) return;
    const timer = setTimeout(() => {
      const playerId = currentPlayer(state).id;
      let next;
      if (state.phase === "roll") {
        const value = randomDie();
        setLast(value);
        next = applyAction(state, { type: "roll", playerId, value });
      } else {
        const entropy = crypto.getRandomValues(new Uint32Array(1))[0]!;
        const pawn = chooseMove(state, difficulty, entropy);
        if (pawn === null) return;
        next = applyAction(state, { type: "move", playerId, pawn });
      }
      setState((previous) =>
        previous.version === state.version ? next : previous,
      );
    }, 450);
    return () => clearTimeout(timer);
  }, [botTurn, state, difficulty]);
  const shown =
    state.players[state.winner ? Number(state.winner) : state.turn]!;
  const status =
    state.phase === "move" && !botTurn && !state.winner ? (
      t.move
    ) : botTurn && !state.winner ? (
      t.botThinking
    ) : (
      <>
        {state.winner ? t.winner : t.turn}:{" "}
        <b style={{ color: colors[shown.seat] }}>{t.names[shown.seat]}</b>
      </>
    );
  return (
    <GameScreen
      t={t}
      title={t.practice}
      onBack={onBack}
      actions={
        <button
          className="icon-btn"
          aria-label={t.settings}
          onClick={() => settings.current?.showModal()}
        >
          <span aria-hidden="true">⚙</span>
        </button>
      }
      board={
        <Board
          state={state}
          interactive={!botTurn}
          t={t}
          onMove={(pawn) =>
            setState((s) =>
              s.phase === "finished"
                ? s
                : applyAction(s, {
                    type: "move",
                    playerId: currentPlayer(s).id,
                    pawn,
                  }),
            )
          }
        />
      }
      players={state.players.map((p, index) => ({
        key: p.id,
        seat: p.seat,
        name:
          bots && index > 0
            ? `${t.robotName} · ${t.names[p.seat]}`
            : t.names[p.seat]!,
        finished: p.pawns.filter((n) => n === FINISH).length,
        current: index === state.turn && state.phase !== "finished",
      }))}
      dice={last}
      status={status}
      rollDisabled={state.phase !== "roll" || botTurn}
      onRoll={() => {
        const value = randomDie();
        setLast(value);
        setState((s) =>
          s.phase === "roll"
            ? applyAction(s, {
                type: "roll",
                playerId: currentPlayer(s).id,
                value,
              })
            : s,
        );
      }}
    >
      {state.phase === "finished" && winner && (
        <ResultDialog
          t={t}
          winnerName={
            bots && winner.id !== "0"
              ? `${t.robotName} · ${t.names[winner.seat]}`
              : t.names[winner.seat]!
          }
          won={bots ? winner.id === "0" : undefined}
          onPlayAgain={() => newGame()}
        />
      )}
      <dialog ref={settings} className="sheet" aria-label={t.settings}>
        <h2>{t.settings}</h2>
        <label>
          {t.players}
          <select
            aria-label={t.players}
            value={count}
            onChange={(e) => newGame(Number(e.target.value))}
          >
            <option value="2">{t.two}</option>
            <option value="3">{t.three}</option>
            <option value="4">{t.four}</option>
          </select>
        </label>
        <label className="bot-option">
          <input
            type="checkbox"
            checked={bots}
            onChange={(e) => setBots(e.target.checked)}
          />
          <span>{t.bot}</span>
        </label>
        {bots && (
          <>
            <label>
              {t.difficulty}
              <select
                aria-label={t.difficulty}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              >
                {(["easy", "normal", "hard"] as const).map((level) => (
                  <option key={level} value={level}>
                    {t[level]}
                  </option>
                ))}
              </select>
            </label>
            <p className="fine">{t.botHint}</p>
          </>
        )}
        <button
          className="secondary"
          onClick={() => {
            newGame();
            settings.current?.close();
          }}
        >
          {t.newGame}
        </button>
        <p className="fine">{t.fairness}</p>
        <button className="primary" onClick={() => settings.current?.close()}>
          {t.close}
        </button>
      </dialog>
    </GameScreen>
  );
}
