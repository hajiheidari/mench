import { useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import {
  chooseMove,
  flagForTimeZone,
  matchName,
  randomOpponent,
  searchDelay,
  thinkingDelay,
  type Difficulty,
  type Opponent,
} from "@mench/game-bot";
import {
  applyAction,
  createGame,
  currentPlayer,
  FINISH,
  type GameState,
} from "@mench/game-engine";
import type { Messages } from "@mench/localization";
import { Board } from "./Board";
import { GameScreen, Searching } from "./GameScreen";
import { ResultModal } from "./ResultModal";
import { newGameId, useWinCoins } from "./coins";
import { Text } from "./Theme";
import { OnlineGame, loadName, useGameClient } from "./OnlineGame";

const ME = "you";
const BOT = "opponent";
const TURN_MS = 30000;

export function randomFloat(): number {
  const [a, b, c, d] = Crypto.getRandomBytes(4);
  return (((a! << 24) | (b! << 16) | (c! << 8) | d!) >>> 0) / 2 ** 32;
}

export function randomDie(): number {
  let value: number;
  do {
    value = Crypto.getRandomBytes(1)[0]!;
  } while (value >= 252);
  return (value % 6) + 1;
}

interface Match {
  opponent: Opponent;
  difficulty: Difficulty;
  state: GameState;
}

function newMatch(opponent: Opponent): Match {
  const order = randomFloat() < 0.5 ? [ME, BOT] : [BOT, ME];
  return {
    opponent,
    difficulty: randomFloat() < 0.6 ? "normal" : "hard",
    state: createGame(order),
  };
}

/**
 * "Quick online game": waits in the server's casual queue first, so two
 * people searching together play each other on the authoritative server; if
 * nobody turns up within a few seconds the practice bot plays under a random
 * name instead.
 */
export function RandomMatch({
  t,
  rtl,
  onBack,
  server,
  token,
}: {
  t: Messages;
  rtl: boolean;
  onBack: () => void;
  server: string;
  token: string | null;
}) {
  // Its own session slot: a friends' room must never show up here.
  const online = useGameClient({ t, server, token, slot: "quick" });
  const live = useRef(online);
  live.current = online;
  const { connected, queued, room } = online.snapshot;
  const [round, setRound] = useState(0);
  const [bot, setBot] = useState<Opponent | null>(null);
  const [ready, setReady] = useState(false);
  const [asked, setAsked] = useState(-1);

  // Join the casual queue as soon as the socket is up.
  useEffect(() => {
    if (!connected || bot || room || queued || asked === round) return;
    setAsked(round);
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    void loadName().then((stored) =>
      live.current.client.current?.send({
        type: "queue",
        name: matchName(flagForTimeZone(zone), stored ?? t.guest, t.guest),
      }),
    );
  }, [connected, bot, room, queued, asked, round, t.guest]);

  // Nobody matched in time (or no connection): the bot takes the seat.
  useEffect(() => {
    let cancelled = false;
    let start: ReturnType<typeof setTimeout> | undefined;
    const search = setTimeout(
      () => {
        void (async () => {
          if (live.current.snapshot.queued) {
            await live.current.client.current?.send({ type: "cancelQueue" });
            // A match that raced the cancel arrives first; let React render it.
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          if (cancelled || live.current.snapshot.room) return;
          setBot(randomOpponent(randomFloat));
          start = setTimeout(() => !cancelled && setReady(true), 1400);
        })();
      },
      searchDelay(randomFloat) + 2500,
    );
    return () => {
      cancelled = true;
      clearTimeout(search);
      clearTimeout(start);
    };
  }, [round]);

  const again = () => {
    const c = live.current;
    if (c.snapshot.room) void c.client.current?.send({ type: "leave" });
    setBot(null);
    setReady(false);
    setRound((r) => r + 1);
  };
  const exit = () => {
    const c = live.current;
    if (c.snapshot.room) void c.client.current?.send({ type: "leave" });
    else if (c.snapshot.queued)
      void c.client.current?.send({ type: "cancelQueue" });
    onBack();
  };

  if (room?.state && !bot)
    return (
      <OnlineGame
        t={t}
        rtl={rtl}
        online={online}
        title={t.random}
        onExit={exit}
        onPlayAgain={again}
      />
    );
  if (bot && ready)
    return (
      <BotMatch
        key={round}
        t={t}
        rtl={rtl}
        opponent={bot}
        onBack={exit}
        onPlayAgain={again}
      />
    );
  return (
    <Searching t={t} rtl={rtl} title={t.random} onBack={exit} found={bot} />
  );
}

/** Two-player game against the practice bot with local CSPRNG dice. */
function BotMatch({
  t,
  rtl,
  opponent,
  onBack,
  onPlayAgain,
}: {
  t: Messages;
  rtl: boolean;
  opponent: Opponent;
  onBack: () => void;
  onPlayAgain: () => void;
}) {
  const [match, setMatch] = useState<Match>(() => newMatch(opponent));
  const [gameId] = useState(newGameId);
  const [last, setLast] = useState<number | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());

  const state = match.state;
  const turnId = state.phase !== "finished" ? currentPlayer(state).id : null;
  const version = state.version;
  useEffect(() => {
    setDeadline(Date.now() + TURN_MS);
  }, [version]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (turnId !== BOT) return;
    const timer = setTimeout(
      () => {
        let next: GameState;
        if (state.phase === "roll") {
          const value = randomDie();
          setLast(value);
          next = applyAction(state, { type: "roll", playerId: BOT, value });
        } else {
          const entropy = Math.floor(randomFloat() * 2 ** 31);
          const pawn = chooseMove(state, match.difficulty, entropy);
          if (pawn === null) return;
          next = applyAction(state, { type: "move", playerId: BOT, pawn });
        }
        setMatch((m) =>
          m.state.version === state.version ? { ...m, state: next } : m,
        );
      },
      thinkingDelay(state.phase === "roll" ? "roll" : "move", randomFloat),
    );
    return () => clearTimeout(timer);
  }, [match, state, turnId]);

  useEffect(() => {
    if (turnId !== ME || now < deadline) return;
    setMatch((m) =>
      m.state.version === state.version
        ? {
            ...m,
            state: applyAction(m.state, { type: "timeout", playerId: ME }),
          }
        : m,
    );
  }, [now, deadline, state, turnId]);

  const opponentLabel = `${match.opponent.flag} ${match.opponent.name}`;
  const label = (id: string) => (id === ME ? t.you : opponentLabel);
  const mine = turnId === ME;
  const winner = state.winner;
  const reward = useWinCoins(
    t,
    winner ? gameId : null,
    winner === ME ? { kind: "bot" } : null,
  );
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <GameScreen
      t={t}
      rtl={rtl}
      title={t.random}
      onBack={onBack}
      board={(size) => (
        <Board
          state={state}
          width={size}
          t={t}
          interactive={mine}
          onMove={(pawn) =>
            setMatch((m) =>
              m.state.phase === "move" && currentPlayer(m.state).id === ME
                ? {
                    ...m,
                    state: applyAction(m.state, {
                      type: "move",
                      playerId: ME,
                      pawn,
                    }),
                  }
                : m,
            )
          }
        />
      )}
      players={state.players.map((p, index) => ({
        key: p.id,
        seat: p.seat,
        name: label(p.id),
        finished: p.pawns.filter((n) => n === FINISH).length,
        current: index === state.turn && state.phase !== "finished",
      }))}
      dice={last}
      status={
        winner
          ? `${t.winner}: ${label(winner)}`
          : mine && state.phase === "move"
            ? t.move
            : `${t.turn}: ${label(turnId ?? ME)}`
      }
      info={
        winner ? undefined : (
          <Text style={{ fontSize: 12, color: "#dbc9ed" }}>
            {seconds} {t.seconds}
          </Text>
        )
      }
      rollDisabled={!mine || state.phase !== "roll"}
      onRoll={() => {
        const value = randomDie();
        setLast(value);
        setMatch((m) =>
          m.state.phase === "roll" && currentPlayer(m.state).id === ME
            ? {
                ...m,
                state: applyAction(m.state, {
                  type: "roll",
                  playerId: ME,
                  value,
                }),
              }
            : m,
        );
      }}
    >
      {winner && (
        <ResultModal
          t={t}
          winnerName={label(winner)}
          won={winner === ME}
          reward={reward}
          onPlayAgain={onPlayAgain}
        />
      )}
    </GameScreen>
  );
}
