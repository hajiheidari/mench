import { View, Text, StyleSheet } from "react-native";
import { useContext } from "react";
import { DICE_STYLES, dicePips, type DiceSkinId } from "@mench/board-geometry";
import { Appearance } from "./appearance";
export function Dice({
  value,
  skin,
}: {
  value: number | null;
  /** Shop previews pass a design; the game uses the player's chosen one. */
  skin?: DiceSkinId;
}) {
  const chosen = useContext(Appearance).dice;
  const look = DICE_STYLES[skin ?? chosen] ?? DICE_STYLES.classic;
  return (
    <View
      style={[
        styles.dice,
        {
          backgroundColor: look.faceTop,
          borderColor: look.rim,
          borderBottomColor: look.edge,
        },
      ]}
      accessible
      accessibilityLabel={String(value ?? "✦")}
    >
      {look.veins ? (
        <View style={styles.veins} pointerEvents="none">
          {VEINS.map(([top, left, width, angle], i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                top,
                left,
                width,
                height: i === 2 ? 1 : 1.5,
                borderRadius: 1,
                backgroundColor: look.veins,
                opacity: i === 2 ? 0.3 : 0.45,
                transform: [{ rotate: `${angle}deg` }],
              }}
            />
          ))}
        </View>
      ) : null}
      {value === null ? (
        <Text style={[styles.idle, { color: look.pip }]}>✦</Text>
      ) : (
        <View style={styles.face}>
          {Array.from({ length: 9 }, (_, i) => (
            <View
              key={i}
              style={[
                styles.pip,
                {
                  backgroundColor: dicePips[value]?.some((pip) => pip === i)
                    ? look.pip
                    : "transparent",
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}
// [top, left, width, angle] of each marble vein, in points on the 74×78 die.
const VEINS: [number, number, number, number][] = [
  [20, -12, 100, 30],
  [50, -10, 96, 20],
  [30, 26, 34, -38],
];
const styles = StyleSheet.create({
  veins: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    overflow: "hidden",
  },
  dice: {
    width: 74,
    height: 78,
    alignSelf: "center",
    marginVertical: 8,
    backgroundColor: "#fff6ef",
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#ffebbe",
    borderBottomWidth: 6,
    borderBottomColor: "#cbb3dd",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#211437",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 5,
  },
  face: {
    width: 44,
    height: 44,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 4,
  },
  pip: { width: 12, height: 12, borderRadius: 6 },
  idle: { fontSize: 38, color: "#9668af" },
});
