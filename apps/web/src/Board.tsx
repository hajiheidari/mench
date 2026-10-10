import {
  boardCell,
  FINISH,
  legalMoves,
  type GameState,
} from "@mench/game-engine";
import type { Messages } from "./messages";
import {
  track,
  bases,
  pawnLocation,
  boardSvg,
  pawnSvg,
} from "@mench/board-geometry";
const boardArt = `data:image/svg+xml,${encodeURIComponent(boardSvg())}`;
const pawnArt = [0, 1, 2, 3].map(
  (seat) => `data:image/svg+xml,${encodeURIComponent(pawnSvg(seat))}`,
);
export { colors } from "@mench/board-geometry";
export function Board({
  state,
  onMove,
  t,
  interactive = true,
}: {
  state: GameState;
  onMove: (pawn: number) => void;
  t: Messages;
  interactive?: boolean;
}) {
  const moves = interactive ? legalMoves(state) : [];
  return (
    <div className="board" dir="ltr">
      <svg viewBox="0 0 15 15" role="img" aria-label={t.rules}>
        <image href={boardArt} width="15" height="15" />
        {bases.map(
          ([x, y], seat) =>
            state.players[state.turn]?.seat === seat &&
            state.phase !== "finished" && (
              <rect
                key={seat}
                className="active-base"
                x={x + 0.24}
                y={y + 0.24}
                width="5.52"
                height="5.52"
                rx=".55"
                fill="none"
                stroke="#fff6b0"
                strokeWidth=".11"
              />
            ),
        )}
        {track.map(
          ([x, y], index) =>
            state.rules.safeCells.includes(index) && (
              <text
                key={index}
                x={x + 0.5}
                y={y + 0.67}
                textAnchor="middle"
                fontSize=".5"
                fill={index % 13 === 0 ? "white" : "#78628d"}
              >
                ★
              </text>
            ),
        )}
      </svg>
      {state.players.flatMap((player, index) =>
        player.pawns.map((position, pawn) => {
          const [x, y] = pawnLocation(player.seat, position, pawn);
          const stacked =
            position >= 0 && position < 52
              ? state.players.flatMap((p) =>
                  p.pawns.filter(
                    (v) => boardCell(p, v) === boardCell(player, position),
                  ),
                ).length
              : 1;
          return (
            <button
              key={`${player.id}-${pawn}`}
              className={`pawn ${index === state.turn && moves.includes(pawn) ? "legal" : ""} ${position === FINISH ? "finished" : ""}`}
              style={{
                left: `${((x + (stacked > 1 ? ((pawn % 2) - 0.5) * 0.22 : 0)) / 15) * 100}%`,
                top: `${((y + (stacked > 1 ? (Math.floor(pawn / 2) - 0.5) * 0.22 : 0)) / 15) * 100}%`,
              }}
              disabled={index !== state.turn || !moves.includes(pawn)}
              onClick={() => onMove(pawn)}
              aria-label={`${t.names[player.seat]} ${t.pawn} ${pawn + 1}`}
              data-progress={position}
            >
              <img
                key={position}
                src={pawnArt[player.seat]}
                alt=""
                draggable={false}
              />
              <span>{pawn + 1}</span>
            </button>
          );
        }),
      )}
    </div>
  );
}
