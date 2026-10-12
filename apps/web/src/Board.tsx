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
  type BoardThemeId,
  type PawnSetId,
} from "@mench/board-geometry";
import { useContext } from "react";
import { Appearance } from "./coins";
const dataUri = (svg: string) =>
  `data:image/svg+xml,${encodeURIComponent(svg)}`;
const boardCache = new Map<BoardThemeId, string>();
const pawnCache = new Map<PawnSetId, string[]>();
export function boardArt(theme: BoardThemeId): string {
  if (!boardCache.has(theme)) boardCache.set(theme, dataUri(boardSvg(theme)));
  return boardCache.get(theme)!;
}
export function pawnArt(set: PawnSetId): string[] {
  if (!pawnCache.has(set))
    pawnCache.set(
      set,
      [0, 1, 2, 3].map((seat) => dataUri(pawnSvg(seat, set))),
    );
  return pawnCache.get(set)!;
}
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
  const look = useContext(Appearance);
  const pawnImages = pawnArt(look.pawns);
  return (
    <div className="board" dir="ltr">
      <svg viewBox="0 0 15 15" role="img" aria-label={t.rules}>
        <image href={boardArt(look.board)} width="15" height="15" />
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
                src={pawnImages[player.seat]}
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
