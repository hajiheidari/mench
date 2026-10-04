export type TournamentSize = 4 | 8 | 16 | 32;
export interface TournamentMatch {
  id: string;
  players: [string | null, string | null];
  winner: string | null;
  gameId: string | null;
  roomCode: string | null;
}
export interface TournamentState {
  capacity: TournamentSize;
  phase: "lobby" | "running" | "finished" | "cancelled";
  players: string[];
  rounds: TournamentMatch[][];
  winner: string | null;
}
export function createTournament(
  capacity: TournamentSize,
  host: string,
): TournamentState {
  if (![4, 8, 16, 32].includes(capacity) || !host) throw Error("INVALID_INPUT");
  return {
    capacity,
    phase: "lobby",
    players: [host],
    rounds: [],
    winner: null,
  };
}
export function joinTournament(
  previous: TournamentState,
  player: string,
): TournamentState {
  if (previous.phase !== "lobby") throw Error("TOURNAMENT_STARTED");
  if (!player) throw Error("INVALID_INPUT");
  if (previous.players.includes(player)) return structuredClone(previous);
  if (previous.players.length >= previous.capacity)
    throw Error("TOURNAMENT_FULL");
  const next = structuredClone(previous);
  next.players.push(player);
  return next;
}
export function startTournament(previous: TournamentState): TournamentState {
  if (previous.phase !== "lobby") throw Error("TOURNAMENT_STARTED");
  if (
    previous.players.length !== previous.capacity ||
    new Set(previous.players).size !== previous.capacity
  )
    throw Error("WAITING_FOR_PLAYERS");
  const next = structuredClone(previous);
  next.phase = "running";
  for (
    let round = 0, count = next.capacity / 2;
    count >= 1;
    round++, count /= 2
  ) {
    next.rounds.push(
      Array.from({ length: count }, (_, index) => ({
        id: `r${round}m${index}`,
        players:
          round === 0
            ? [next.players[index * 2]!, next.players[index * 2 + 1]!]
            : [null, null],
        winner: null,
        gameId: null,
        roomCode: null,
      })),
    );
  }
  return next;
}
export function linkMatch(
  previous: TournamentState,
  matchId: string,
  gameId: string,
  roomCode: string,
): TournamentState {
  if (previous.phase !== "running") throw Error("TOURNAMENT_INACTIVE");
  const next = structuredClone(previous);
  const match = next.rounds.flat().find((m) => m.id === matchId);
  if (!match || match.winner || match.players.some((p) => !p))
    throw Error("MATCH_UNAVAILABLE");
  if (match.gameId && match.gameId !== gameId)
    throw Error("MATCH_ALREADY_LINKED");
  if (next.rounds.flat().some((m) => m.id !== matchId && m.gameId === gameId))
    throw Error("MATCH_ALREADY_LINKED");
  match.gameId = gameId;
  match.roomCode = roomCode;
  return next;
}
export function completeMatch(
  previous: TournamentState,
  gameId: string,
  winner: string,
): TournamentState {
  const next = structuredClone(previous);
  const round = next.rounds.findIndex((matches) =>
    matches.some((m) => m.gameId === gameId),
  );
  if (round < 0) throw Error("MATCH_UNAVAILABLE");
  const index = next.rounds[round]!.findIndex((m) => m.gameId === gameId);
  const match = next.rounds[round]![index]!;
  if (
    !winner ||
    !match.players.includes(winner) ||
    match.players.some((p) => !p)
  )
    throw Error("INVALID_WINNER");
  if (match.winner) {
    if (match.winner !== winner) throw Error("RESULT_CONFLICT");
    return next;
  }
  if (next.phase !== "running") throw Error("TOURNAMENT_INACTIVE");
  match.winner = winner;
  if (round === next.rounds.length - 1) {
    next.phase = "finished";
    next.winner = winner;
  } else
    next.rounds[round + 1]![Math.floor(index / 2)]!.players[index % 2] = winner;
  return next;
}
