import { Image, View, Pressable, Text, StyleSheet } from "react-native";
import {
  legalMoves,
  FINISH,
  boardCell,
  type GameState,
} from "@mench/game-engine";
import { bases, track, pawnLocation } from "@mench/board-geometry";
import type { Messages } from "@mench/localization";
import boardArt from "./assets/game/board.png";
import pawn0 from "./assets/game/pawn-0.png";
import pawn1 from "./assets/game/pawn-1.png";
import pawn2 from "./assets/game/pawn-2.png";
import pawn3 from "./assets/game/pawn-3.png";
const pawnArt = [pawn0, pawn1, pawn2, pawn3];
export function Board({
  state,
  width,
  onMove,
  t,
  interactive,
}: {
  state: GameState;
  width: number;
  onMove: (pawn: number) => void;
  t: Messages;
  interactive: boolean;
}) {
  const size = width - 6;
  const scale = size / 15;
  const moves = interactive ? legalMoves(state) : [];
  const activeBase = bases[state.players[state.turn]!.seat]!;
  return (
    // The board is geometry, not text: in a Persian (RTL) layout iOS swaps
    // `left`/`right`, which put every pawn in the mirrored home.
    <View style={[styles.frame, { width, height: width, direction: "ltr" }]}>
      <View
        style={{
          position: "absolute",
          left: 3,
          top: 3,
          width: size,
          height: size,
        }}
      >
        <Image
          source={boardArt}
          accessibilityIgnoresInvertColors
          style={{ width: size, height: size, borderRadius: 13 }}
        />
        {state.phase !== "finished" && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: (activeBase[0] + 0.24) * scale,
              top: (activeBase[1] + 0.24) * scale,
              width: 5.52 * scale,
              height: 5.52 * scale,
              borderRadius: 0.55 * scale,
              borderWidth: 2,
              borderColor: "#fff3a7",
            }}
          />
        )}
        {track.map(
          ([x, y], i) =>
            state.rules.safeCells.includes(i) && (
              <Text
                key={i}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: x * scale,
                  top: (y + 0.1) * scale,
                  width: scale,
                  textAlign: "center",
                  fontSize: scale * 0.55,
                  color: i % 13 === 0 ? "white" : "#78628d",
                }}
              >
                ★
              </Text>
            ),
        )}
        {state.players.flatMap((p, index) =>
          p.pawns.map((position, pawn) => {
            const [x, y] = pawnLocation(p.seat, position, pawn);
            // About one cell wide: as large as the classic 15-cell grid allows.
            const pawnWidth = (position === FINISH ? 0.55 : 0.98) * scale;
            const pawnHeight = pawnWidth * 1.25;
            const legal = index === state.turn && moves.includes(pawn);
            const stacked =
              position >= 0 && position < 52
                ? state.players.flatMap((other) =>
                    other.pawns.filter(
                      (v) => boardCell(other, v) === boardCell(p, position),
                    ),
                  ).length
                : 1;
            const dx = stacked > 1 ? ((pawn % 2) - 0.5) * 0.22 * scale : 0;
            const dy =
              stacked > 1 ? (Math.floor(pawn / 2) - 0.5) * 0.22 * scale : 0;
            return (
              <Pressable
                key={`${p.id}-${pawn}`}
                hitSlop={legal ? 14 : 4}
                accessibilityRole="button"
                accessibilityLabel={`${t.names[p.seat]} ${t.pawn} ${pawn + 1}`}
                disabled={!legal}
                onPress={() => onMove(pawn)}
                style={{
                  position: "absolute",
                  left: x * scale - pawnWidth / 2 + dx,
                  // Centre the body on the cell/home circle; a base anchor let
                  // the head stick out of the white circles.
                  top: y * scale - pawnHeight * 0.58 + dy,
                  width: pawnWidth,
                  height: pawnHeight,
                  borderRadius: pawnWidth * 0.4,
                  borderWidth: legal ? 2 : 0,
                  borderColor: "#fff6a6",
                  zIndex: legal ? 3 : 2,
                }}
              >
                <Image
                  source={pawnArt[p.seat]!}
                  style={{ width: "100%", height: "100%" }}
                />
                <Text
                  style={{
                    position: "absolute",
                    bottom: "21%",
                    width: "100%",
                    textAlign: "center",
                    color: "white",
                    fontSize: pawnWidth * 0.32,
                    fontWeight: "bold",
                    textShadowColor: "#4d2859",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                >
                  {pawn + 1}
                </Text>
              </Pressable>
            );
          }),
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  frame: {
    alignSelf: "center",
    borderRadius: 16,
    backgroundColor: "#f6d289",
    borderBottomWidth: 3,
    borderBottomColor: "#a87538",
    shadowColor: "#100822",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 9,
  },
});
