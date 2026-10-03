import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  EVENTS,
  type Intent,
  type PublicRoom,
  type Reply,
} from "@mench/game-protocol";
interface Session {
  code: string;
  token: string;
  playerId: string;
}
const key = "mench-session-v1";
function load(): Session | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Session;
    if (
      typeof value.code === "string" &&
      typeof value.token === "string" &&
      typeof value.playerId === "string"
    )
      return value;
  } catch {
    /* Invalid local state must never authorize a server operation. */
  }
  return null;
}
export function useOnline() {
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const socket = useRef<Socket | null>(null);
  const session = useRef<Session | null>(load());
  const commitments = useRef(new Map<string, string>());
  const nonces = useRef(new Map<string, string>());
  const adopt = useRef((reply: Reply) => {
    if (!reply.ok) {
      setError(reply.error);
      return;
    }
    if (reply.room) {
      if (reply.room.commitment)
        commitments.current.set(
          reply.room.commitment.hash,
          reply.room.commitment.hash,
        );
      setRoom((old) =>
        old?.code === reply.room!.code &&
        old.state &&
        reply.room!.state &&
        old.state.version > reply.room!.state.version
          ? old
          : reply.room,
      );
      if (reply.token && reply.playerId) {
        session.current = {
          code: reply.room.code,
          token: reply.token,
          playerId: reply.playerId,
        };
        sessionStorage.setItem(key, JSON.stringify(session.current));
      }
      if (reply.playerId) setPlayerId(reply.playerId);
      setQueued(false);
    } else if (reply.queued !== undefined) setQueued(reply.queued);
  });
  useEffect(() => {
    const s = io({ autoConnect: false });
    socket.current = s;
    s.on("connect", () => {
      setConnected(true);
      const saved = session.current;
      if (saved) {
        void s
          .timeout(5000)
          .emitWithAck(EVENTS.COMMAND, {
            version: 1,
            requestId: crypto.randomUUID(),
            payload: { type: "resume", code: saved.code, token: saved.token },
          })
          .then((r: Reply) => {
            if (!r.ok) {
              session.current = null;
              sessionStorage.removeItem(key);
              setRoom(null);
              setPlayerId(null);
            }
            adopt.current(r);
          })
          .catch(() => setError("CONNECTION_FAILED"));
      }
    });
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", () => setError("CONNECTION_FAILED"));
    s.on(EVENTS.SNAPSHOT, (r: PublicRoom) =>
      adopt.current({ ok: true, room: r }),
    );
    s.on("v1:matched", (r: Reply) => adopt.current(r));
    s.on(EVENTS.REPLACED, () => {
      s.disconnect();
      setError("SESSION_REPLACED");
      setConnected(false);
    });
    s.connect();
    return () => {
      s.removeAllListeners();
      s.disconnect();
      socket.current = null;
    };
  }, []);
  async function send(payload: Intent) {
    if (!socket.current?.connected) {
      setError("CONNECTION_FAILED");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const reply = (await socket.current
        .timeout(5000)
        .emitWithAck(EVENTS.COMMAND, {
          version: 1,
          requestId: crypto.randomUUID(),
          payload,
        })) as Reply;
      adopt.current(reply);
      if (reply.ok && payload.type === "leave") {
        session.current = null;
        sessionStorage.removeItem(key);
        setRoom(null);
        setPlayerId(null);
      }
      return reply;
    } catch {
      setError("CONNECTION_FAILED");
    } finally {
      setBusy(false);
    }
  }
  return {
    room,
    playerId,
    connected,
    queued,
    error,
    busy,
    send,
    commitments,
    nonces,
  };
}
