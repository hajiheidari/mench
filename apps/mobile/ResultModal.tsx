import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import type { Messages } from "@mench/localization";
import { Text, useDirection } from "./Theme";

/** Native counterpart of the web ResultDialog: who won, congratulations, play again. */
export function ResultModal({
  t,
  winnerName,
  won,
  onPlayAgain,
}: {
  t: Messages;
  winnerName: string;
  won?: boolean | undefined;
  onPlayAgain?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => setVisible(true), [winnerName]);
  const dir = useDirection();
  const title =
    won === true
      ? t.congratulations
      : won === false
        ? t.opponentWon
        : t.gameOver;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <View style={[styles.backdrop, { direction: dir }]}>
        <View
          style={styles.card}
          accessibilityViewIsModal
          accessibilityRole="alert"
          accessibilityLabel={`${title}. ${t.winner}: ${winnerName}`}
        >
          <Text style={styles.symbol} accessible={false}>
            {won === false ? "✦" : "🏆"}
          </Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>
            {t.winner}: <Text style={styles.winner}>{winnerName}</Text>
          </Text>
          <View style={styles.actions}>
            {onPlayAgain && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.playAgain}
                style={[styles.button, styles.primary]}
                onPress={() => {
                  setVisible(false);
                  onPlayAgain();
                }}
              >
                <Text style={[styles.buttonText, { color: "#382a3f" }]}>
                  {t.playAgain}
                </Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.viewBoard}
              style={styles.button}
              onPress={() => setVisible(false)}
            >
              <Text style={styles.buttonText}>{t.viewBoard}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#160c26cc",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 10,
    backgroundColor: "#3b2463",
    borderWidth: 3,
    borderColor: "#f3c35f",
    borderRadius: 24,
    padding: 24,
  },
  symbol: { fontSize: 48, lineHeight: 64 },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffe7a0",
    textAlign: "center",
  },
  body: { fontSize: 16, color: "#fff4df", textAlign: "center" },
  winner: { fontWeight: "bold", color: "#ffffff" },
  actions: { flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap" },
  button: {
    backgroundColor: "#63418c",
    borderWidth: 1,
    borderColor: "#b48acb",
    borderBottomWidth: 4,
    borderBottomColor: "#33204e",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minHeight: 48,
    justifyContent: "center",
  },
  primary: {
    backgroundColor: "#35be88",
    borderColor: "#a8f8bf",
    borderBottomColor: "#177b62",
  },
  buttonText: { color: "#fff2d7", fontSize: 14, fontWeight: "bold" },
});
