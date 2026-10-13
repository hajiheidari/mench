import { Image, View, Text, StyleSheet } from "react-native";
import { useContext } from "react";
import { DICE_STYLES, dicePips, type DiceSkinId } from "@mench/board-geometry";
import { Appearance } from "./appearance";
import { DICE_ART } from "./themeArt";
export function Dice({
  value,
  skin,
}: {
  value: number | null;
  /** Shop previews pass a design; the game uses the player's chosen one. */
  skin?: DiceSkinId;
}) {
  const chosen = useContext(Appearance).dice;
  const id = skin ?? chosen;
  const look = DICE_STYLES[id] ?? DICE_STYLES.classic;
  const texture = DICE_ART[id];
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
      {texture ? (
        <View style={styles.texture} pointerEvents="none">
          <Image
            source={texture}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
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
const styles = StyleSheet.create({
  texture: {
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
