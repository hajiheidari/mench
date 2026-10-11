import { useEffect, useState } from "react";
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
import { ResultDialog } from "./ResultDialog";
import { Board } from "./Board";
import { GameScreen, TopBar, randomDie, randomFloat } from "./GameScreen";
import type { Messages } from "./messages";

const ME = "you";
const BOT = "opponent";
const TURN_MS = 30000;

interface Match {
  opponent: Opponent;
  difficulty: Difficulty;
  state: GameState;
}

function newMatch(): Match {
  // Random seat order: sometimes the opponent starts.
  const order = randomFloat() < 0.5 ? [ME, BOT] : [BOT, ME];
  return {
    opponent: randomOpponent(randomFloat),
    difficulty: randomFloat() < 0.6 ? "normal" : "hard",
    state: createGame(order),
  };
}

/**
 * "Random online": a two-player game against the practice bot presented as a
 * matched opponent with a random name. Dice are the same local random dice as
 * practice; the bot only ever plays legal engine moves.
 */
export function RandomMatch({
  t,
  onBack,
}: {
  t: Messages;
  onBack: () => void;
}) {
  const [match, setMatch] = useState<Match | null>(null);
  const [found, setFound] = useState<Opponent | null>(null);
  const [last, setLast] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());

  // Matchmaking pause, then a short "opponent found" moment.
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

  // A fresh 30 s clock for every step, like the online rooms.
  useEffect(() => {
    if (version !== undefined) setDeadline(Date.now() + TURN_MS);
  }, [version]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // The opponent plays after a human-like pause.
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
          const entropy = crypto.getRandomValues(new Uint32Array(1))[0]!;
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

  // Idle human turns time out, as in online rooms.
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
      <div className="game-screen">
        <TopBar t={t} title={t.random} onBack={onBack} />
        <div className="searching" role="status">
          {found ? (
            <>
              <span className="found-flag" aria-hidden="true">
                {found.flag}
              </span>
              <strong>{found.name}</strong>
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
        <ResultDialog
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
