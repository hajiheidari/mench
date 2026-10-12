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
const styles = StyleSheet.create({
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
