import type { GameState } from "@mench/game-engine";
import type { DiceContext, DiceProof } from "@mench/fair-dice";
export const PROTOCOL_VERSION = 1 as const;
export const EVENTS = {
  COMMAND: "v1:command",
  SNAPSHOT: "v1:snapshot",
  REPLACED: "v1:replaced",
  MATCHED: "v1:matched",
} as const;
export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
}
export interface PublicRoom {
  code: string;
  ranked?: boolean;
  hostId: string;
  players: PublicPlayer[];
  capacity: number;
  state: GameState | null;
  deadline: number | null;
  commitment: { hash: string; context: DiceContext } | null;
  proofs: DiceProof[];
}
export interface Envelope<T> {
  version: typeof PROTOCOL_VERSION;
  requestId: string;
  payload: T;
}
export type Intent =
  | { type: "create"; name: string; capacity: number; ranked?: boolean }
  | { type: "join"; name: string; code: string }
  | { type: "resume"; code: string; token: string }
  | { type: "start" }
  | { type: "roll"; nonce: string; expectedVersion: number }
  | { type: "move"; pawn: number; expectedVersion: number }
  | { type: "leave" }
  | { type: "queue"; name: string; ranked?: boolean }
  | { type: "cancelQueue" };
export type Command = Envelope<Intent>;
export type Reply =
  | {
      ok: true;
      room: PublicRoom | null;
      playerId?: string;
      token?: string;
      queued?: boolean;
    }
  | { ok: false; error: string };
export interface SocialPerson {
  id: string;
  name: string;
}
export interface SocialSnapshot {
  friends: (SocialPerson & {
    accepted: boolean;
    incoming: boolean;
    online: boolean;
  })[];
  blocks: SocialPerson[];
  recent: SocialPerson[];
  invites: (SocialPerson & { code: string })[];
}
export type SocialIntent =
  | { type: "request" | "accept" | "remove" | "block" | "unblock" }
  | { type: "report"; reason: "abuse" | "cheating" | "spam" }
  | { type: "invite"; code: string };
export interface RatingSummary {
  rating: number;
  games: number;
  wins: number;
}
export interface Rankings {
  players: (SocialPerson & RatingSummary)[];
}
