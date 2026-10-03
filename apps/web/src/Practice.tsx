import { useState } from "react";
import {
  applyAction,
  createGame,
  currentPlayer,
  FINISH,
} from "@mench/game-engine";
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
  const [count, setCount] = useState(2);
  const [state, setState] = useState(() => createGame(["0", "1"]));
  const [last, setLast] = useState<number | null>(null);
  return (
    <div className="game-layout">
      <section>
        <Board
          state={state}
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
          disabled={state.phase !== "roll"}
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
        {state.phase === "move" && <p role="status">{t.move}</p>}
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
            onChange={(e) => setCount(Number(e.target.value))}
          >
            <option value="2">{t.two}</option>
            <option value="3">{t.three}</option>
            <option value="4">{t.four}</option>
          </select>
        </label>
        <button
          className="secondary"
          onClick={() => {
            setState(
              createGame(Array.from({ length: count }, (_, i) => String(i))),
            );
            setLast(null);
          }}
        >
          {t.newGame}
        </button>
        <p className="fine">{t.fairness}</p>
      </aside>
    </div>
  );
}
