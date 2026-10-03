export const ENGINE_VERSION = 1 as const;
export const TRACK_LENGTH = 52;
export const FINISH = 57;
export interface GameRules {
  enterOn: readonly number[];
  safeCells: readonly number[];
  extraOnSix: boolean;
  extraOnCapture: boolean;
  extraOnFinish: boolean;
  consecutiveSixLimit: number;
  exactFinish: boolean;
}
export const STANDARD_RULES: GameRules = {
  enterOn: [6],
  safeCells: [0, 8, 13, 21, 26, 34, 39, 47],
  extraOnSix: true,
  extraOnCapture: true,
  extraOnFinish: true,
  consecutiveSixLimit: 3,
  exactFinish: true,
};
export interface Player {
  id: string;
  seat: number;
  pawns: number[];
  connected: boolean;
}
export interface GameState {
  version: number;
  players: Player[];
  rules: GameRules;
  turn: number;
  phase: "roll" | "move" | "finished";
  dice: number | null;
  sixes: number;
  winner: string | null;
}
export type Action =
  | { type: "roll"; playerId: string; value: number }
  | { type: "move"; playerId: string; pawn: number }
  | { type: "timeout"; playerId: string }
  | { type: "connection"; playerId: string; connected: boolean };
export class RuleError extends Error {}
export function createGame(
  ids: readonly string[],
  rules: GameRules = STANDARD_RULES,
): GameState {
  if (
    ids.length < 2 ||
    ids.length > 4 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !id)
  )
    throw new RuleError("INVALID_PLAYERS");
  if (
    !rules.enterOn.length ||
    rules.enterOn.some((v) => !Number.isInteger(v) || v < 1 || v > 6) ||
    rules.safeCells.some(
      (v) => !Number.isInteger(v) || v < 0 || v >= TRACK_LENGTH,
    ) ||
    !Number.isInteger(rules.consecutiveSixLimit) ||
    rules.consecutiveSixLimit < 1
  )
    throw new RuleError("INVALID_RULES");
  return {
    version: 0,
    players: ids.map((id, index) => ({
      id,
      seat: ids.length === 2 ? index * 2 : index,
      pawns: [-1, -1, -1, -1],
      connected: true,
    })),
    rules: structuredClone(rules),
    turn: 0,
    phase: "roll",
    dice: null,
    sixes: 0,
    winner: null,
  };
}
export function currentPlayer(state: GameState): Player {
  const player = state.players[state.turn];
  if (!player) throw new RuleError("INVALID_STATE");
  return player;
}
export function boardCell(player: Player, progress: number): number | null {
  return progress >= 0 && progress < TRACK_LENGTH
    ? (player.seat * 13 + progress) % TRACK_LENGTH
    : null;
}
export function legalMoves(state: GameState): number[] {
  if (state.phase !== "move" || state.dice === null) return [];
  const dice = state.dice;
  return currentPlayer(state).pawns.flatMap((position, index) => {
    if (position === FINISH) return [];
    if (position === -1)
      return state.rules.enterOn.includes(dice) ? [index] : [];
    return !state.rules.exactFinish || position + dice <= FINISH ? [index] : [];
  });
}
function nextTurn(state: GameState): void {
  state.turn = (state.turn + 1) % state.players.length;
  state.phase = "roll";
  state.dice = null;
  state.sixes = 0;
}
export function applyAction(previous: GameState, action: Action): GameState {
  if (previous.phase === "finished") throw new RuleError("GAME_FINISHED");
  const state = structuredClone(previous);
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) throw new RuleError("UNKNOWN_PLAYER");
  if (action.type === "connection") {
    player.connected = action.connected;
    state.version++;
    return state;
  }
  if (currentPlayer(state).id !== action.playerId)
    throw new RuleError("NOT_YOUR_TURN");
  if (action.type === "timeout") {
    nextTurn(state);
    state.version++;
    return state;
  }
  if (action.type === "roll") {
    if (state.phase !== "roll") throw new RuleError("ALREADY_ROLLED");
    if (!Number.isInteger(action.value) || action.value < 1 || action.value > 6)
      throw new RuleError("INVALID_DICE");
    state.dice = action.value;
    state.sixes = action.value === 6 ? state.sixes + 1 : 0;
    state.phase = "move";
    if (state.sixes >= state.rules.consecutiveSixLimit) nextTurn(state);
    else if (!legalMoves(state).length) {
      if (action.value === 6 && state.rules.extraOnSix) {
        state.phase = "roll";
        state.dice = null;
      } else nextTurn(state);
    }
  } else {
    if (
      !Number.isInteger(action.pawn) ||
      !legalMoves(state).includes(action.pawn)
    )
      throw new RuleError("ILLEGAL_MOVE");
    const before = player.pawns[action.pawn];
    if (before === undefined || state.dice === null)
      throw new RuleError("INVALID_STATE");
    const target = before === -1 ? 0 : Math.min(FINISH, before + state.dice);
    player.pawns[action.pawn] = target;
    let captured = false;
    const cell = boardCell(player, target);
    if (cell !== null && !state.rules.safeCells.includes(cell))
      for (const opponent of state.players) {
        if (opponent.id === player.id) continue;
        opponent.pawns = opponent.pawns.map((position) => {
          if (boardCell(opponent, position) === cell) {
            captured = true;
            return -1;
          }
          return position;
        });
      }
    if (player.pawns.every((position) => position === FINISH)) {
      state.phase = "finished";
      state.winner = player.id;
      state.dice = null;
    } else if (
      (state.dice === 6 && state.rules.extraOnSix) ||
      (captured && state.rules.extraOnCapture) ||
      (target === FINISH && state.rules.extraOnFinish)
    ) {
      state.phase = "roll";
      state.dice = null;
    } else nextTurn(state);
  }
  state.version++;
  return state;
}
export function replay(
  initial: GameState,
  actions: readonly Action[],
): GameState {
  return actions.reduce(applyAction, structuredClone(initial));
}
