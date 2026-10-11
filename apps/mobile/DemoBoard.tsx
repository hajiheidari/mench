import { useEffect, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { chooseMove } from "@mench/game-bot";
import {
  applyAction,
  createGame,
  currentPlayer,
  type GameState,
} from "@mench/game-engine";
import type { Messages } from "@mench/localization";
import { Board } from "./Board";
import { randomDie, randomFloat } from "./RandomMatch";

const SEATS = ["a", "b", "c", "d"];

/** One engine step for the attract-mode game (bots on every seat). */
function step(game: GameState): GameState {
  const playerId = currentPlayer(game).id;
  if (game.phase === "roll")
    return applyAction(game, { type: "roll", playerId, value: randomDie() });
  const pawn = chooseMove(game, "normal", Math.floor(randomFloat() * 2 ** 31));
  return pawn === null
    ? applyAction(game, { type: "timeout", playerId })
    : applyAction(game, { type: "move", playerId, pawn });
}

/** A game already under way, so the demo starts with pawns on the track. */
function warmGame(): GameState {
  let game = createGame(SEATS);
  for (let i = 0; i < 60 && game.phase !== "finished"; i++) game = step(game);
  return game.phase === "finished" ? createGame(SEATS) : game;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Decorative home-screen board: four bots play real engine moves and each
 * pawn walks cell by cell. Fills the height left under the mode buttons.
 */
export function DemoBoard({ t }: { t: Messages }) {
  const [view, setView] = useState<GameState>(warmGame);
  const [area, setArea] = useState({ width: 0, height: 0 });
  useEffect(() => {
    let stopped = false;
    void (async () => {
      if (await AccessibilityInfo.isReduceMotionEnabled()) return;
      let game = warmGame();
      let moves = 0;
      while (!stopped) {
        if (game.phase === "finished" || moves > 400) {
          await pause(1500);
          game = warmGame();
          moves = 0;
          setView(game);
          continue;
        }
        const next = step(game);
        moves++;
        if (game.phase === "move") {
          // Walk the moving pawn one cell at a time before the real result.
          const seat = game.turn;
          const before = game.players[seat]!.pawns;
          const after = next.players[seat]!.pawns;
          const pawn = before.findIndex((p, i) => p !== after[i]);
          if (pawn >= 0) {
            const from = before[pawn]!;
            const to = after[pawn]!;
            for (let p = from === -1 ? 0 : from + 1; p < to; p++) {
              if (stopped) return;
              const players = game.players.map((pl, i) =>
                i === seat
                  ? {
                      ...pl,
                      pawns: pl.pawns.map((v, j) => (j === pawn ? p : v)),
                    }
                  : pl,
              );
              setView({ ...game, players });
              await pause(170);
            }
          }
        }
        if (stopped) return;
        game = next;
        setView(game);
        await pause(game.phase === "move" ? 450 : 650);
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);
  const size = Math.floor(Math.min(area.width, area.height, 460) - 8);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{
        flex: 1,
        minHeight: 0,
        alignItems: "center",
        justifyContent: "center",
      }}
      onLayout={(e) => setArea(e.nativeEvent.layout)}
    >
      {size > 140 && (
        <Board
          state={view}
          width={size}
          t={t}
          interactive={false}
          onMove={() => undefined}
        />
      )}
    </View>
  );
}
