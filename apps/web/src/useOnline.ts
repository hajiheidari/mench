import { useEffect, useRef, useState } from "react";
import { GameClient, type ClientState, type Session } from "@mench/game-client";
import type { Intent } from "@mench/game-protocol";
const key = "mench-session-v1";
function load(): Session | null {
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
export function useOnline() {
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
      session: load(),
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
  }, []);
  return {
    ...state,
    send: (payload: Intent) => client.current?.send(payload),
    commitments,
    nonces,
  };
}
