import { FINISH } from "@mench/game-engine";
export const colors = ["#ef3333", "#24b83e", "#ffe035", "#2988ef"];
export const track = [
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
export const bases = [
  [0, 0],
  [0, 9],
  [9, 9],
  [9, 0],
] as const;
export function pawnLocation(
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

export {
  avatarSvg,
  boardSvg,
  pawnSvg,
  backdropSvg,
  dicePips,
  depths,
} from "./art";
