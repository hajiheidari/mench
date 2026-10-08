import type { Action, GameState } from "@mench/game-engine";
import type { DiceContext, DiceProof } from "@mench/fair-dice";
export const PROTOCOL_VERSION = 1 as const;
export const EVENTS = {
  COMMAND: "v1:command",
  SNAPSHOT: "v1:snapshot",
  REPLACED: "v1:replaced",
  MATCHED: "v1:matched",
  AUTH_REVOKED: "v1:auth_revoked",
} as const;
export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
}
export interface PublicRoom {
  code: string;
  revision?: number;
  matchId?: string;
  ranked?: boolean;
  hostId: string;
  players: PublicPlayer[];
  capacity: number;
  state: GameState | null;
  deadline: number | null;
  commitment: { hash: string; context: DiceContext } | null;
  proofs: DiceProof[];
  proofOffset?: number;
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
export type CosmeticSku = "aurora" | "sunset";
export interface EconomySnapshot {
  balance: string;
  active: CosmeticSku | null;
  catalog: { sku: CosmeticSku; price: number }[];
  owned: CosmeticSku[];
  ledger: {
    kind: "reward" | "purchase";
    delta: string;
    metadata: { gameId?: string; won?: boolean; sku?: CosmeticSku };
    created_at: string;
  }[];
}
import type { TournamentState } from "@mench/tournament";
export interface PublicTournament extends TournamentState {
  id: string;
  owner: string | null;
  profiles: SocialPerson[];
}
export interface TournamentListing {
  tournaments: {
    id: string;
    capacity: number;
    phase: TournamentState["phase"];
  }[];
}
export type TournamentIntent =
  | { type: "join" | "leave" | "start" | "cancel" }
  | { type: "link"; matchId: string; code: string };
export type ModerationReason = "abuse" | "cheating" | "spam";
export type AdminIntent =
  | {
      type: "suspend";
      requestId: string;
      userId: string;
      days: number;
      reason: ModerationReason;
    }
  | {
      type: "unsuspend";
      requestId: string;
      userId: string;
      reason: ModerationReason;
    }
  | {
      type: "report";
      requestId: string;
      reportId: string;
      status: "dismissed" | "actioned";
    }
  | {
      type: "cancelTournament";
      requestId: string;
      tournamentId: string;
      reason: ModerationReason;
    };
export interface AdminSummary {
  users: { id: string; name: string; banned_until: string | null }[];
  reports: {
    id: string;
    reporter: string | null;
    subject: string | null;
    reason: ModerationReason;
    status: "pending" | "dismissed" | "actioned";
    created_at: string;
  }[];
  ledger: {
    wallet_id: string;
    kind: "reward" | "purchase";
    delta: string;
    metadata: object;
    created_at: string;
  }[];
  audit: {
    actor_id: string | null;
    subject_id: string | null;
    reference_id: string | null;
    action: AdminIntent["type"];
    metadata: object;
    created_at: string;
  }[];
  tournaments: { id: string; phase: "lobby" | "running"; capacity: number }[];
  health: { healthy: boolean; rooms: number; activeGames: number };
}

export interface GameTranscript {
  initialState: GameState;
  actions: Action[];
  finalState: GameState;
  proofs: DiceProof[];
}
export interface GameHistory {
  games: {
    id: string;
    createdAt: string;
    ranked: boolean;
    won: boolean;
    players: { id: string; name: string }[];
    replayAvailable: boolean;
  }[];
}

export { verifyTranscriptConsistency } from "./replay";
