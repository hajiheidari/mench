import { useEffect, useState } from "react";
import * as Crypto from "expo-crypto";
import {
  chooseMove,
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
import { Text } from "./Theme";

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

function newMatch(): Match {
  const order = randomFloat() < 0.5 ? [ME, BOT] : [BOT, ME];
  return {
    opponent: randomOpponent(randomFloat),
    difficulty: randomFloat() < 0.6 ? "normal" : "hard",
    state: createGame(order),
  };
}

/**
 * "Random online": a two-player game against the practice bot presented as a
 * matched opponent with a random name, same rules and local dice as practice.
 */
export function RandomMatch({
  t,
  rtl,
  onBack,
}: {
  t: Messages;
  rtl: boolean;
  onBack: () => void;
}) {
  const [match, setMatch] = useState<Match | null>(null);
  const [found, setFound] = useState<Opponent | null>(null);
  const [last, setLast] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setMatch(null);
    setFound(null);
    setLast(null);
    const next = newMatch();
    const wait = searchDelay(randomFloat);
    const search = setTimeout(() => setFound(next.opponent), wait);
    const start = setTimeout(() => setMatch(next), wait + 1400);
    return () => {
      clearTimeout(search);
      clearTimeout(start);
    };
  }, [round]);

  const state = match?.state;
  const turnId =
    state && state.phase !== "finished" ? currentPlayer(state).id : null;
  const version = state?.version;
  useEffect(() => {
    if (version !== undefined) setDeadline(Date.now() + TURN_MS);
  }, [version]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!match || !state || turnId !== BOT) return;
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
          m && m.state.version === state.version ? { ...m, state: next } : m,
        );
      },
      thinkingDelay(state.phase === "roll" ? "roll" : "move", randomFloat),
    );
    return () => clearTimeout(timer);
  }, [match, state, turnId]);

  useEffect(() => {
    if (!state || turnId !== ME || now < deadline) return;
    setMatch((m) =>
      m && m.state.version === state.version
        ? {
            ...m,
            state: applyAction(m.state, { type: "timeout", playerId: ME }),
          }
        : m,
    );
  }, [now, deadline, state, turnId]);

  if (!match || !state)
    return (
      <Searching
        t={t}
        rtl={rtl}
        title={t.random}
        onBack={onBack}
        found={found}
      />
    );

  const opponentLabel = `${match.opponent.flag} ${match.opponent.name}`;
  const label = (id: string) => (id === ME ? t.you : opponentLabel);
  const mine = turnId === ME;
  const winner = state.winner;
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
              m && m.state.phase === "move" && currentPlayer(m.state).id === ME
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
          m && m.state.phase === "roll" && currentPlayer(m.state).id === ME
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
          key={round}
          t={t}
          winnerName={label(winner)}
          won={winner === ME}
          onPlayAgain={() => setRound((r) => r + 1)}
        />
      )}
    </GameScreen>
  );
}
