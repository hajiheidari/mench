import { useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { currentPlayer, FINISH } from "@mench/game-engine";
import { GameClient, type ClientState, type Session } from "@mench/game-client";
import type { Messages } from "@mench/localization";
import { verifyProof } from "@mench/fair-dice/portable";
import { Board } from "./Board";
import { GameScreen, IconButton } from "./GameScreen";
import { ResultModal } from "./ResultModal";
import { getStored, setStored } from "./storage";
import { Text } from "./Theme";

/**
 * Store and web builds set EXPO_PUBLIC_BACKEND=edge: casual online rooms on
 * mench.espadna.com (Cloudflare). Accounts need the full Node API and stay hidden.
 */
export const EDGE = process.env.EXPO_PUBLIC_BACKEND === "edge";
export const DEFAULT_SERVER =
  process.env.EXPO_PUBLIC_API_URL ??
  (EDGE ? "https://mench.espadna.com" : "http://127.0.0.1:3001");

const NAME_KEY = "mench-name";
/** The last display name the player typed, reused by every online mode. */
export async function loadName(): Promise<string | null> {
  try {
    return (await getStored(NAME_KEY))?.trim().slice(0, 24) || null;
  } catch {
    return null;
  }
}
export function saveName(name: string) {
  if (name.trim())
    void setStored(NAME_KEY, name.trim().slice(0, 24)).catch(() => undefined);
}

export interface Online {
  snapshot: ClientState;
  client: React.RefObject<GameClient | null>;
  notice: string;
  setNotice: (notice: string) => void;
}

/** One authoritative-server connection with a resumable room session. */
export function useGameClient({
  t,
  server,
  token,
}: {
  t: Messages;
  server: string;
  token: string | null;
}): Online {
  const client = useRef<GameClient | null>(null);
  const [snapshot, setSnapshot] = useState<ClientState>({
    room: null,
    playerId: null,
    connected: false,
    queued: false,
    busy: false,
    error: "",
  });
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    let stop: (() => void) | undefined;
    void getStored("mench-room")
      .then((raw) => {
        if (!live) return;
        let session: Session | null = null;
        if (raw)
          try {
            session = JSON.parse(raw) as Session;
          } catch {
            setNotice(t.error);
          }
        const c = new GameClient({
          url: server,
          transport: EDGE ? "websocket" : "socket.io",
          requestId: Crypto.randomUUID,
          session,
          ...(token ? { token } : {}),
          save: (value) => {
            void setStored(
              "mench-room",
              value ? JSON.stringify(value) : null,
            ).catch(() => setNotice(t.secureStorage));
          },
        });
        client.current = c;
        stop = c.subscribe(setSnapshot);
        c.connect();
      })
      .catch(() => setNotice(t.secureStorage));
    return () => {
      live = false;
      stop?.();
      client.current?.close();
      client.current = null;
    };
  }, [server, token, t.error, t.secureStorage]);
  return { snapshot, client, notice, setNotice };
}

/** A running server-authoritative game; shared by friends' rooms and quick match. */
export function OnlineGame({
  t,
  rtl,
  online,
  title,
  onExit,
  onPlayAgain,
}: {
  t: Messages;
  rtl: boolean;
  online: Online;
  title: string;
  onExit: () => void;
  onPlayAgain?: () => void;
}) {
  const { snapshot, client, notice, setNotice } = online;
  const { room, connected, busy, playerId, error } = snapshot;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const state = room?.state;
  if (!room || !state) return null;
  const mine =
    state.phase !== "finished" &&
    currentPlayer(state).id === playerId &&
    connected &&
    !busy;
  const winner = state.winner
    ? room.players.find((p) => p.id === state.winner)
    : undefined;
  // Guests often keep the default nickname; colour and "(you)" keep players apart.
  const label = (id: string | null | undefined) => {
    const index = room.players.findIndex((p) => p.id === id);
    const player = room.players[index];
    const seat = state.players[index]?.seat;
    if (!player || seat === undefined) return player?.name ?? "";
    return `${t.names[seat]} · ${player.name}${id === playerId ? ` (${t.you})` : ""}`;
  };
  const active = state.winner ?? currentPlayer(state).id;
  const proof = room.proofs.at(-1);
  const seconds = room.deadline
    ? Math.max(0, Math.ceil((room.deadline - now) / 1000))
    : 0;
  return (
    <GameScreen
      t={t}
      rtl={rtl}
      title={title}
      onBack={onExit}
      actions={
        proof ? (
          <IconButton
            label={t.verify}
            icon="✔"
            onPress={() => {
              const observed = client.current?.commitments.get(
                proof.commitment,
              );
              setNotice(
                !observed
                  ? t.unwitnessed
                  : verifyProof(
                        proof,
                        observed,
                        client.current?.nonces.get(proof.commitment) ??
                          proof.nonce,
                      )
                    ? t.verified
                    : t.invalidProof,
              );
            }}
          />
        ) : undefined
      }
      board={(size) => (
        <Board
          state={state}
          width={size}
          t={t}
          interactive={mine}
          onMove={(pawn) =>
            void client.current?.send({
              type: "move",
              pawn,
              expectedVersion: state.version,
            })
          }
        />
      )}
      players={room.players.map((p, index) => ({
        key: p.id,
        seat: state.players[index]!.seat,
        name: `${p.name}${p.id === playerId ? ` (${t.you})` : ""}`,
        finished: state.players[index]!.pawns.filter((n) => n === FINISH)
          .length,
        current: p.id === active && state.phase !== "finished",
      }))}
      dice={state.dice ?? proof?.value ?? null}
      status={
        mine && state.phase === "move"
          ? t.move
          : `${state.winner ? t.winner : t.turn}: ${label(active)}`
      }
      info={
        <>
          <Text
            accessibilityLiveRegion="polite"
            style={{ fontSize: 12, color: "#dbc9ed" }}
          >
            {connected ? t.connected : t.reconnecting}
            {!state.winner && room.deadline ? ` · ${seconds} ${t.seconds}` : ""}
          </Text>
          {notice ? (
            <Text accessibilityLiveRegion="polite">{notice}</Text>
          ) : null}
          {error ? (
            <Text style={{ color: "#ffb6be" }}>
              {t.errors[error] ?? t.error}
            </Text>
          ) : null}
        </>
      }
      rollDisabled={!mine || state.phase !== "roll" || !room.commitment}
      onRoll={() => {
        const nonce = Array.from(Crypto.getRandomBytes(32), (v) =>
          v.toString(16).padStart(2, "0"),
        ).join("");
        client.current?.nonces.set(room.commitment!.hash, nonce);
        void client.current?.send({
          type: "roll",
          nonce,
          expectedVersion: state.version,
        });
      }}
    >
      {state.phase === "finished" && winner && (
        <ResultModal
          key={room.matchId ?? room.code}
          t={t}
          winnerName={label(winner.id)}
          won={state.winner === playerId}
          {...(onPlayAgain ? { onPlayAgain } : {})}
        />
      )}
    </GameScreen>
  );
}
