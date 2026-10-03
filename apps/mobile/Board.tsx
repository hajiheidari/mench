import { View, Pressable, Text, StyleSheet } from "react-native";
import { legalMoves, FINISH, type GameState } from "@mench/game-engine";
import { bases, track, colors, pawnLocation } from "@mench/board-geometry";
import type { Messages } from "@mench/localization";
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
  const scale = width / 15;
  const moves = interactive ? legalMoves(state) : [];
  return (
    <View
      style={{
        width,
        height: width,
        backgroundColor: "#fffdf8",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {bases.map(([x, y], seat) => (
        <View
          key={seat}
          style={[
            styles.base,
            {
              left: x * scale,
              top: y * scale,
              width: 6 * scale,
              height: 6 * scale,
              backgroundColor: colors[seat],
            },
          ]}
        />
      ))}
      {track.map(([x, y], i) => (
        <View
          key={`cell-${i}`}
          style={[
            styles.cell,
            {
              left: (x + 0.05) * scale,
              top: (y + 0.05) * scale,
              width: 0.9 * scale,
              height: 0.9 * scale,
              backgroundColor: i % 13 === 0 ? colors[i / 13] : "#edf1e8",
            },
          ]}
        >
          {state.rules.safeCells.includes(i) && (
            <Text style={{ fontSize: scale * 0.5, color: "#415f4c" }}>★</Text>
          )}
        </View>
      ))}
      {[0, 1, 2, 3].flatMap((seat) =>
        [1, 2, 3, 4, 5, 6].map((n) => {
          const [x, y] =
            seat === 0
              ? [7, n]
              : seat === 1
                ? [n, 7]
                : seat === 2
                  ? [7, 14 - n]
                  : [14 - n, 7];
          return (
            <View
              key={`home-${seat}-${n}`}
              style={[
                styles.cell,
                {
                  left: x! * scale,
                  top: y! * scale,
                  width: scale,
                  height: scale,
                  backgroundColor: colors[seat],
                  opacity: 0.4,
                },
              ]}
            />
          );
        }),
      )}
      <View
        style={[
          styles.cell,
          {
            left: 6.1 * scale,
            top: 6.1 * scale,
            width: 2.8 * scale,
            height: 2.8 * scale,
            backgroundColor: "#203e38",
          },
        ]}
      >
        <Text style={{ color: "white", fontSize: scale }}>✦</Text>
      </View>
      {state.players.flatMap((p, index) =>
        p.pawns.map((position, pawn) => {
          const [x, y] = pawnLocation(p.seat, position, pawn);
          const size = (position === FINISH ? 0.4 : 0.65) * scale;
          const legal = index === state.turn && moves.includes(pawn);
          return (
            <Pressable
              key={`${p.id}-${pawn}`}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${t.names[p.seat]} ${t.pawn} ${pawn + 1}`}
              disabled={!legal}
              onPress={() => onMove(pawn)}
              style={{
                position: "absolute",
                left: x * scale - size / 2,
                top: y * scale - size / 2,
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: colors[p.seat],
                borderWidth: legal ? 3 : 1,
                borderColor: legal ? "#213c32" : "white",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: size * 0.5,
                  fontWeight: "bold",
                }}
              >
                {pawn + 1}
              </Text>
            </Pressable>
          );
        }),
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  base: { position: "absolute", opacity: 0.2, borderRadius: 10 },
  cell: {
    position: "absolute",
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
