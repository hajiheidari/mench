import { useEffect, useRef, useState } from "react";
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
import { ResultDialog } from "./ResultDialog";
import { Board } from "./Board";
import { GameScreen, TopBar, randomDie, randomFloat } from "./GameScreen";
import type { Messages } from "./messages";
import { useOnline } from "./useOnline";
import { OnlineGame } from "./Online";
import { savedName } from "./nickname";

const ME = "you";
const BOT = "opponent";
const TURN_MS = 30000;

interface Match {
  opponent: Opponent;
  difficulty: Difficulty;
  state: GameState;
}

function newMatch(opponent: Opponent): Match {
  // Random seat order: sometimes the opponent starts.
  const order = randomFloat() < 0.5 ? [ME, BOT] : [BOT, ME];
  return {
    opponent,
    difficulty: randomFloat() < 0.6 ? "normal" : "hard",
    state: createGame(order),
  };
}

/** How long a player waits in the real queue before the bot steps in. */
function queueWindow(): number {
  return searchDelay(randomFloat) + 2500;
}

/**
 * "Quick online game": first waits in the server's casual queue, so two
 * people searching at the same time play each other on the authoritative
 * server. If nobody turns up in a few seconds, the practice bot plays under a
 * random name instead.
 */
export function RandomMatch({
  t,
  onBack,
}: {
  t: Messages;
  onBack: () => void;
}) {
  const online = useOnline();
  const live = useRef(online);
  live.current = online;
  const [round, setRound] = useState(0);
  const [bot, setBot] = useState<Opponent | null>(null);
  const [ready, setReady] = useState(false);
  const [asked, setAsked] = useState(-1);
  const { connected, queued, room, send } = online;
  const realGame = !!room?.state;

  // Join the casual queue as soon as the socket is up.
  useEffect(() => {
    if (!connected || bot || room || queued || asked === round) return;
    setAsked(round);
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    void send({
      type: "queue",
      name: matchName(flagForTimeZone(zone), savedName(t.guest), t.guest),
    });
  }, [connected, bot, room, queued, asked, round, send, t.guest]);

  // Nobody matched in time (or no connection): the bot takes the seat.
  useEffect(() => {
    let cancelled = false;
    let start: ReturnType<typeof setTimeout> | undefined;
    const search = setTimeout(() => {
      void (async () => {
        if (live.current.queued) {
          await live.current.send({ type: "cancelQueue" });
          // A match that raced the cancel arrives first; let React render it.
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        if (cancelled || live.current.room) return;
        setBot(randomOpponent(randomFloat));
        start = setTimeout(() => !cancelled && setReady(true), 1400);
      })();
    }, queueWindow());
    return () => {
      cancelled = true;
      clearTimeout(search);
      clearTimeout(start);
    };
  }, [round]);

  const again = () => {
    if (live.current.room) void live.current.send({ type: "leave" });
    setBot(null);
    setReady(false);
    setRound((r) => r + 1);
  };
  const exit = () => {
    const current = live.current;
    if (current.room) void current.send({ type: "leave" });
    else if (current.queued) void current.send({ type: "cancelQueue" });
    onBack();
  };

  if (realGame && !bot)
    return (
      <OnlineGame
        t={t}
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
        opponent={bot}
        onBack={exit}
        onPlayAgain={again}
      />
    );
  return (
    <div className="game-screen">
      <TopBar t={t} title={t.random} onBack={exit} />
      <div className="searching" role="status">
        {bot ? (
          <>
            <span className="found-flag" aria-hidden="true">
              {bot.flag}
            </span>
            <strong>{bot.name}</strong>
            <span>{t.found}</span>
          </>
        ) : (
          <>
            <span className="spinner" aria-hidden="true" />
            <span>{t.searching}</span>
          </>
        )}
      </div>
    </div>
  );
}

/** Two-player game against the practice bot with local CSPRNG dice. */
function BotMatch({
  t,
  opponent,
  onBack,
  onPlayAgain,
}: {
  t: Messages;
  opponent: Opponent;
  onBack: () => void;
  onPlayAgain: () => void;
}) {
  const [match, setMatch] = useState<Match>(() => newMatch(opponent));
  const [last, setLast] = useState<number | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());

  const state = match.state;
  const turnId = state.phase !== "finished" ? currentPlayer(state).id : null;
  const version = state.version;

  // A fresh 30 s clock for every step, like the online rooms.
  useEffect(() => {
    setDeadline(Date.now() + TURN_MS);
  }, [version]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // The opponent plays after a human-like pause.
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
          const entropy = crypto.getRandomValues(new Uint32Array(1))[0]!;
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

  // Idle human turns time out, as in online rooms.
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
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <GameScreen
      t={t}
      title={t.random}
      onBack={onBack}
      board={
        <Board
          state={state}
          interactive={mine}
          t={t}
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
      }
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
        !winner && (
          <span className="timer">
            {seconds} {t.seconds}
          </span>
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
        <ResultDialog
          t={t}
          winnerName={label(winner)}
          won={winner === ME}
          onPlayAgain={onPlayAgain}
        />
      )}
    </GameScreen>
  );
}
