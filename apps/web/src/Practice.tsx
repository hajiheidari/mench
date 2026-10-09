import { useEffect, useState } from "react";
import { chooseMove, type Difficulty } from "@mench/game-bot";
import {
  applyAction,
  createGame,
  currentPlayer,
  FINISH,
} from "@mench/game-engine";
import { ResultDialog } from "./ResultDialog";
import { Board, colors } from "./Board";
import type { Messages } from "./messages";
function randomDie(): number {
  const bytes = new Uint8Array(1);
  do {
    crypto.getRandomValues(bytes);
  } while (bytes[0]! >= 252);
  return (bytes[0]! % 6) + 1;
}
export function Practice({ t }: { t: Messages }) {
  const [state, setState] = useState(() => createGame(["0", "1"]));
  const [last, setLast] = useState<number | null>(null);
  const [bots, setBots] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
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
  return (
    <div className="game-layout">
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
      <section>
        <Board
          state={state}
          interactive={!botTurn}
          t={t}
          onMove={(pawn) =>
            setState((s) =>
              applyAction(s, {
                type: "move",
                playerId: currentPlayer(s).id,
                pawn,
              }),
            )
          }
        />
        <p className="board-hint">{t.hint}</p>
      </section>
      <aside className="panel">
        <span className="eyebrow">{t.offline}</span>
        <h2>
          {state.winner ? t.winner : t.turn}:{" "}
          <span
            style={{
              color:
                colors[
                  state.players[
                    state.winner ? Number(state.winner) : state.turn
                  ]!.seat
                ],
            }}
          >
            {
              t.names[
                state.players[state.winner ? Number(state.winner) : state.turn]!
                  .seat
              ]
            }
          </span>
        </h2>
        <div className="dice" aria-live="polite">
          {last ?? "✦"}
        </div>
        <button
          className="primary"
          disabled={state.phase !== "roll" || botTurn}
          onClick={() => {
            const value = randomDie();
            setLast(value);
            setState((s) =>
              applyAction(s, {
                type: "roll",
                playerId: currentPlayer(s).id,
                value,
              }),
            );
          }}
        >
          {t.roll}
        </button>
        {state.phase === "move" && !botTurn && <p role="status">{t.move}</p>}
        {botTurn && <p role="status">{t.botThinking}</p>}
        <div className="players">
          {state.players.map((p) => (
            <div key={p.id}>
              <span className="dot" style={{ background: colors[p.seat] }} />
              {t.names[p.seat]}
              <small>
                {p.pawns.filter((n) => n === FINISH).length}/4 {t.home}
              </small>
            </div>
          ))}
        </div>
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
        <label>
          <input
            type="checkbox"
            checked={bots}
            onChange={(e) => setBots(e.target.checked)}
          />
          {t.bot}
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
        <button className="secondary" onClick={() => newGame()}>
          {t.newGame}
        </button>
        <p className="fine">{t.fairness}</p>
      </aside>
    </div>
  );
}
