import { useEffect, useRef, useState } from "react";
import { GameClient, type ClientState, type Session } from "@mench/game-client";
import type { Intent } from "@mench/game-protocol";
import { EDGE, SERVER } from "./backend";
/** Friends' rooms and quick matches keep separate resumable sessions. */
export type SessionSlot = "friends" | "quick";
const keys: Record<SessionSlot, string> = {
  friends: "mench-session-v1",
  quick: "mench-quick-session-v1",
};
function load(key: string): Session | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Session;
    if (
      typeof v.code === "string" &&
      typeof v.token === "string" &&
      typeof v.playerId === "string"
    )
      return v;
  } catch {
    /* Corrupted local state cannot authorize server operations. */
  }
  return null;
}
export function useOnline(slot: SessionSlot = "friends") {
  const key = keys[slot];
  const client = useRef<GameClient | null>(null);
  const commitments = useRef(new Map<string, string>());
  const nonces = useRef(new Map<string, string>());
  const [state, setState] = useState<ClientState>({
    room: null,
    playerId: null,
    connected: false,
    queued: false,
    busy: false,
    error: "",
  });
  useEffect(() => {
    const c = new GameClient({
      requestId: () => crypto.randomUUID(),
      transport: EDGE ? "websocket" : "socket.io",
      ...(SERVER ? { url: SERVER } : {}),
      session: load(key),
      save: (session) =>
        session
          ? sessionStorage.setItem(key, JSON.stringify(session))
          : sessionStorage.removeItem(key),
    });
    client.current = c;
    commitments.current = c.commitments;
    nonces.current = c.nonces;
    const stop = c.subscribe(setState);
    c.connect();
    return () => {
      stop();
      c.close();
      client.current = null;
    };
  }, [key]);
  return {
    ...state,
    send: (payload: Intent) => client.current?.send(payload),
    /** This device's seat (room code and secret), for claiming win coins. */
    session: () => client.current?.currentSession ?? null,
    commitments,
    nonces,
  };
}
