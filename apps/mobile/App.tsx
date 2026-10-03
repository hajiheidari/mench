import { View, Text, StyleSheet } from "react-native";
import { messages } from "./messages";
export default function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{messages.fa.title}</Text>
      <Text style={styles.caption}>{messages.fa.status}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf2ee",
  },
  title: { fontSize: 42, color: "#122e36" },
  caption: { marginTop: 20, writingDirection: "rtl", color: "#49675d" },
});
