import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { Messages } from "@mench/localization";
import { Text } from "./Theme";
import { Dice } from "./Dice";
import { Avatar } from "./Avatar";

export interface HudPlayer {
  key: string;
  seat: number;
  name: string;
  finished: number;
  current: boolean;
}

export function IconButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={styles.icon}
    >
      {/* ltr: under rtl text the › and ‹ glyphs would be mirrored. */}
      <Text style={[styles.iconText, { writingDirection: "ltr" }]}>{icon}</Text>
    </Pressable>
  );
}

export function TopBar({
  t,
  title,
  onBack,
  actions,
  rtl,
}: {
  t: Messages;
  title: string;
  onBack: () => void;
  actions?: ReactNode;
  rtl: boolean;
}) {
  return (
    <View style={styles.topbar}>
      <IconButton label={t.back} icon={rtl ? "›" : "‹"} onPress={onBack} />
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.actions}>{actions}</View>
    </View>
  );
}

/**
 * One-screen game frame. The board area measures the space left between the
 * top bar and the controls and draws the largest square that fits, so the
 * screen never scrolls on any phone.
 */
export function GameScreen({
  t,
  rtl,
  title,
  onBack,
  actions,
  board,
  players,
  dice,
  status,
  rollDisabled,
  onRoll,
  info,
  children,
}: {
  t: Messages;
  rtl: boolean;
  title: string;
  onBack: () => void;
  actions?: ReactNode;
  board: (size: number) => ReactNode;
  players: HudPlayer[];
  dice: number | null;
  status: string;
  rollDisabled: boolean;
  onRoll: () => void;
  info?: ReactNode;
  children?: ReactNode;
}) {
  const [area, setArea] = useState({ width: 0, height: 0 });
  const size = Math.floor(Math.min(area.width, area.height) - 2);
  return (
    <View style={styles.screen}>
      <TopBar t={t} title={title} onBack={onBack} actions={actions} rtl={rtl} />
      <View
        style={styles.boardArea}
        onLayout={(e) => setArea(e.nativeEvent.layout)}
      >
        {size > 120 && board(size)}
      </View>
      <View style={styles.chips}>
        {players.map((p) => (
          <View
            key={p.key}
            style={[styles.chip, p.current && styles.chipCurrent]}
          >
            <Avatar seat={p.seat} />
            <Text style={styles.chipName} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={styles.chipCount}>{p.finished}/4</Text>
          </View>
        ))}
      </View>
      {info ? <View style={styles.info}>{info}</View> : null}
      <View style={styles.rollBar}>
        <View style={styles.diceBox}>
          <Dice value={dice} />
        </View>
        <Text
          style={styles.status}
          numberOfLines={2}
          accessibilityLiveRegion="polite"
        >
          {status}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.roll}
          disabled={rollDisabled}
          onPress={onRoll}
          style={[styles.roll, rollDisabled && { opacity: 0.45 }]}
        >
          <Text style={styles.rollText}>{t.roll}</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

export function Searching({
  t,
  rtl,
  title,
  onBack,
  found,
}: {
  t: Messages;
  rtl: boolean;
  title: string;
  onBack: () => void;
  found: { name: string; flag: string } | null;
}) {
  return (
    <View style={styles.screen}>
      <TopBar t={t} title={title} onBack={onBack} rtl={rtl} />
      <View style={styles.searching} accessibilityLiveRegion="polite">
        {found ? (
          <>
            <Text style={styles.flag}>{found.flag}</Text>
            <Text style={styles.foundName}>{found.name}</Text>
            <Text>{t.found}</Text>
          </>
        ) : (
          <>
            <Spinner />
            <Text style={styles.searchText}>{t.searching}</Text>
          </>
        )}
      </View>
    </View>
  );
}

function Spinner() {
  // A die cycling through its faces: light and on-theme.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => (n + 1) % 6), 350);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.spinner}>
      <Dice value={tick + 1} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: "100%", paddingHorizontal: 12, gap: 8 },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "bold",
    color: "#ffe7a0",
  },
  actions: { minWidth: 44, alignItems: "flex-end" },
  icon: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ad7acc",
    backgroundColor: "#3c235f",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 22, color: "#fff3d5", lineHeight: 28 },
  boardArea: {
    flex: 1,
    minHeight: 0,
    // Phones: the board may use the screen gutter too; width is the limit.
    marginHorizontal: -9,
    alignItems: "center",
    justifyContent: "center",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "48%",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#9d72b8",
    backgroundColor: "#2a193fbb",
  },
  chipCurrent: { borderColor: "#ffdf8d", borderWidth: 2 },
  chipName: { color: "#fff2dc", fontSize: 12, flexShrink: 1 },
  chipCount: { color: "#dbc9ed", fontSize: 11 },
  info: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  rollBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#b281cb",
    backgroundColor: "#4a2f6cee",
  },
  diceBox: { transform: [{ scale: 0.8 }] },
  status: { flex: 1, fontSize: 13, lineHeight: 20 },
  roll: {
    minWidth: 120,
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#35be88",
    borderWidth: 1,
    borderColor: "#a8f8bf",
    borderBottomWidth: 4,
    borderBottomColor: "#177b62",
    alignItems: "center",
    justifyContent: "center",
  },
  rollText: { color: "#382a3f", fontWeight: "bold", fontSize: 16 },
  searching: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  searchText: { fontSize: 18, textAlign: "center" },
  flag: { fontSize: 64, lineHeight: 80 },
  foundName: { fontSize: 22, fontWeight: "bold", color: "#ffe7a0" },
  spinner: { transform: [{ scale: 1.1 }] },
});
