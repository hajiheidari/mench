import {
  boardCell,
  FINISH,
  legalMoves,
  type GameState,
} from "@mench/game-engine";
import type { Messages } from "./messages";
export const colors = ["#d66a55", "#388872", "#d3a32d", "#508aaa"];
const track = [
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  [0, 7],
  [0, 8],
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  [7, 14],
  [8, 14],
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  [14, 7],
  [14, 6],
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  [7, 0],
  [6, 0],
] as const;
const bases = [
  [0, 0],
  [0, 9],
  [9, 9],
  [9, 0],
] as const;
function location(
  seat: number,
  position: number,
  pawn: number,
): [number, number] {
  if (position === -1) {
    const base = bases[seat]!;
    return [
      base[0] + 1.65 + (pawn % 2) * 2.3,
      base[1] + 1.65 + Math.floor(pawn / 2) * 2.3,
    ];
  }
  if (position === FINISH)
    return [6.9 + (pawn % 2) * 0.6, 6.9 + Math.floor(pawn / 2) * 0.6];
  if (position >= 52) {
    const n = position - 51;
    return seat === 0
      ? [7.5, n + 0.5]
      : seat === 1
        ? [n + 0.5, 7.5]
        : seat === 2
          ? [7.5, 14.5 - n]
          : [14.5 - n, 7.5];
  }
  const cell = track[(seat * 13 + position) % 52]!;
  return [cell[0] + 0.5, cell[1] + 0.5];
}
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
        <rect width="15" height="15" rx=".6" fill="#fffdf8" />
        {bases.map(([x, y], seat) => (
          <g key={seat}>
            <rect
              x={x + 0.2}
              y={y + 0.2}
              width="5.6"
              height="5.6"
              rx=".6"
              fill={colors[seat]}
              opacity=".14"
            />
            <rect
              x={x + 1}
              y={y + 1}
              width="4"
              height="4"
              rx=".6"
              fill="white"
              stroke={colors[seat]}
              strokeWidth=".04"
            />
          </g>
        ))}
        {track.map(([x, y], index) => (
          <g key={index}>
            <rect
              x={x + 0.04}
              y={y + 0.04}
              width=".92"
              height=".92"
              rx=".15"
              fill={index % 13 === 0 ? colors[index / 13] : "#f0f2ec"}
              opacity={index % 13 === 0 ? 0.65 : 1}
            />
            {state.rules.safeCells.includes(index) && (
              <text
                x={x + 0.5}
                y={y + 0.67}
                textAnchor="middle"
                fontSize=".5"
                fill="#65746c"
              >
                ★
              </text>
            )}
          </g>
        ))}
        {[0, 1, 2, 3].flatMap((seat) =>
          [1, 2, 3, 4, 5, 6].map((n) => {
            const [x, y] =
              seat === 0
                ? [7, n]
                : seat === 1
                  ? [n, 7]
                  : seat === 2
                    ? [7, 14 - n]
                    : [14 - n, 7];
            return (
              <rect
                key={`${seat}-${n}`}
                x={x! + 0.05}
                y={y! + 0.05}
                width=".9"
                height=".9"
                rx=".13"
                fill={colors[seat]}
                opacity=".4"
              />
            );
          }),
        )}
        <rect x="6.1" y="6.1" width="2.8" height="2.8" rx=".6" fill="#163d3a" />
        <text x="7.5" y="8" fontSize="1.1" textAnchor="middle" fill="#fbf6df">
          ✦
        </text>
      </svg>
      {state.players.flatMap((player, index) =>
        player.pawns.map((position, pawn) => {
          const [x, y] = location(player.seat, position, pawn);
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
                backgroundColor: colors[player.seat],
              }}
              disabled={index !== state.turn || !moves.includes(pawn)}
              onClick={() => onMove(pawn)}
              aria-label={`${t.names[player.seat]} ${t.pawn} ${pawn + 1}`}
              data-progress={position}
            >
              {pawn + 1}
            </button>
          );
        }),
      )}
    </div>
  );
}
