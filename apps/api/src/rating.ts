// Ranked launch uses two-player games only; zero-sum Elo, fixed K=32.
export function eloDelta(winner: number, loser: number): number {
  if (!Number.isInteger(winner) || !Number.isInteger(loser))
    throw Error("INVALID_RATING");
  const expectation = 1 / (1 + 10 ** ((loser - winner) / 400));
  return Math.round(32 * (1 - expectation));
}
