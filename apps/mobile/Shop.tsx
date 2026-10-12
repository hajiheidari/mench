import { useEffect, useState, type ReactNode } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  DAILY_COINS,
  type BoardThemeId,
  type DiceSkinId,
  type PawnSetId,
} from "@mench/board-geometry";
import { Dice } from "./Dice";
import { rewardedAds } from "./ads";
import type { Messages } from "@mench/localization";
import { TopBar } from "./GameScreen";
import { Text, useDirection } from "./Theme";
import { BOARD_ART, PAWN_ART } from "./themeArt";
import type { Wallet } from "./coins";

/** A gold coin, drawn so it looks the same on every phone (the 🪙 emoji is silver on iOS). */
export function Coin({ size = 18 }: { size?: number }) {
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#f2b51f",
        borderWidth: Math.max(1, size / 12),
        borderColor: "#b9790b",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: size,
          backgroundColor: "#ffd659",
          borderWidth: Math.max(1, size / 16),
          borderColor: "#fff0a8",
        }}
      />
    </View>
  );
}

export function CoinChip({
  t,
  coins,
  onPress,
}: {
  t: Messages;
  coins: number | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.shop} · ${coins ?? 0} ${t.coins}`}
      onPress={onPress}
      style={styles.chip}
    >
      <Coin size={20} />
      <Text style={styles.chipText}>{coins ?? "…"}</Text>
    </Pressable>
  );
}

function ActionButton({
  title,
  icon,
  label,
  onPress,
  primary,
  disabled,
}: {
  title: string;
  icon?: ReactNode;
  label?: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        primary && styles.actionPrimary,
        disabled && { opacity: 0.5 },
      ]}
    >
      {icon}
      <Text style={[styles.actionText, primary && { color: "#2c1f33" }]}>
        {title}
      </Text>
    </Pressable>
  );
}

/** Board image sized in pixels from its card (percent sizes crop on web). */
function BoardPreview({ theme }: { theme: BoardThemeId }) {
  const [size, setSize] = useState(0);
  return (
    <View
      style={styles.preview}
      onLayout={(e) => setSize(Math.floor(e.nativeEvent.layout.width))}
    >
      {size > 0 && (
        <Image
          source={BOARD_ART[theme]}
          style={{ width: size, height: size }}
        />
      )}
    </View>
  );
}

/** Once a day on the home screen: collect the free coins. */
export function DailyModal({ t, wallet }: { t: Messages; wallet: Wallet }) {
  const [dismissed, setDismissed] = useState(false);
  const dir = useDirection();
  const daily = wallet.wallet?.daily ?? DAILY_COINS;
  return (
    <Modal
      visible={Boolean(wallet.wallet?.dailyAvailable) && !dismissed}
      transparent
      animationType="fade"
      onRequestClose={() => setDismissed(true)}
    >
      <View style={[styles.backdrop, { direction: dir }]}>
        <View style={styles.sheet}>
          <View style={styles.bigCoin}>
            <Coin size={64} />
          </View>
          <Text style={styles.heading}>{t.dailyTitle}</Text>
          <Text style={styles.body}>
            {t.dailyBody.replace("{n}", String(daily))}
          </Text>
          <ActionButton
            title={`${t.collect} +${daily}`}
            primary
            disabled={wallet.busy}
            onPress={() => void wallet.claim().then(() => setDismissed(true))}
          />
          <ActionButton title={t.later} onPress={() => setDismissed(true)} />
        </View>
      </View>
    </Modal>
  );
}

export function Shop({
  t,
  rtl,
  wallet,
  onBack,
}: {
  t: Messages;
  rtl: boolean;
  wallet: Wallet;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"board" | "pawns" | "dice">("board");
  const [notice, setNotice] = useState("");
  const [watching, setWatching] = useState(false);
  const w = wallet.wallet;
  useEffect(() => rewardedAds?.prepare(), []);
  const locale = rtl ? "fa" : "en";
  const items = (w?.catalog ?? []).filter((i) => i.kind === tab);
  return (
    <View style={{ flex: 1, width: "100%", paddingHorizontal: 12 }}>
      <TopBar
        t={t}
        title={t.shop}
        onBack={onBack}
        rtl={rtl}
        actions={<CoinChip t={t} coins={w?.coins ?? null} onPress={() => {}} />}
      />
      <View style={styles.tabs}>
        {(["board", "pawns", "dice"] as const).map((kind) => (
          <Pressable
            key={kind}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === kind }}
            onPress={() => setTab(kind)}
            style={[styles.tab, tab === kind && styles.tabSelected]}
          >
            <Text
              style={[styles.tabText, tab === kind && { color: "#3b2463" }]}
            >
              {kind === "board"
                ? t.boardsTab
                : kind === "pawns"
                  ? t.pawnsTab
                  : t.diceTab}
            </Text>
          </Pressable>
        ))}
      </View>
      {!w && <Text style={styles.notice}>{t.shopOffline}</Text>}
      {w && rewardedAds && (
        <View style={styles.adRow}>
          <ActionButton
            title={t.watchAd.replace("{n}", String(w.adCoins))}
            primary
            disabled={wallet.busy || watching || w.adsLeft === 0}
            onPress={() => {
              setWatching(true);
              setNotice("");
              void rewardedAds!
                .show()
                .then((earned) => (earned ? wallet.adReward() : false))
                .catch(() => false)
                .then((ok) => {
                  setWatching(false);
                  setNotice(
                    ok
                      ? t.adThanks.replace("{n}", String(w.adCoins))
                      : t.adFailed,
                  );
                });
            }}
          />
          <Text style={styles.notice}>
            {w.adsLeft > 0
              ? t.adsLeft.replace("{n}", String(w.adsLeft))
              : t.adsDone}
          </Text>
        </View>
      )}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.grid}
      >
        {items.map((item) => {
          const owned = w?.owned.includes(item.sku) ?? false;
          const inUse = w?.equipped[item.kind] === item.id;
          return (
            <View key={item.sku} style={[styles.card, inUse && styles.inUse]}>
              {item.kind === "board" ? (
                <BoardPreview theme={item.id as BoardThemeId} />
              ) : item.kind === "dice" ? (
                <View style={[styles.preview, styles.dicePreview]}>
                  <Dice value={5} skin={item.id as DiceSkinId} />
                </View>
              ) : (
                <View style={[styles.preview, styles.pawns]}>
                  {PAWN_ART[item.id as PawnSetId].map((src, seat) => (
                    <Image
                      key={seat}
                      source={src}
                      style={{ width: "40%", height: "44%" }}
                      resizeMode="contain"
                    />
                  ))}
                </View>
              )}
              <Text style={styles.name}>{item.name[locale]}</Text>
              {inUse ? (
                <Text style={styles.inUseText}>✓ {t.inUse}</Text>
              ) : owned ? (
                <ActionButton
                  title={t.use}
                  disabled={wallet.busy}
                  onPress={() => void wallet.equip(item.sku)}
                />
              ) : (
                <ActionButton
                  title={String(item.price)}
                  icon={<Coin />}
                  label={`${t.buy} ${item.name[locale]} ${item.price} ${t.coins}`}
                  primary
                  disabled={wallet.busy || !w}
                  onPress={() => {
                    if (w && w.coins < item.price) {
                      setNotice(t.notEnough);
                      return;
                    }
                    void wallet
                      .buy(item.sku)
                      .then((ok) => setNotice(ok ? t.bought : t.notEnough));
                  }}
                />
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    gap: 6,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#f3c35f",
    backgroundColor: "#3c235f",
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { color: "#ffe7a0", fontSize: 16, fontWeight: "bold" },
  backdrop: {
    flex: 1,
    backgroundColor: "#160c26cc",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    gap: 12,
    backgroundColor: "#3b2463",
    borderWidth: 2,
    borderColor: "#f3c35f",
    borderRadius: 24,
    padding: 20,
    alignItems: "stretch",
  },
  bigCoin: { alignItems: "center", paddingVertical: 4 },
  heading: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff4df",
    textAlign: "center",
  },
  body: { color: "#f4e9ff", textAlign: "center", lineHeight: 24 },
  action: {
    flexDirection: "row",
    gap: 6,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ad7acc",
    backgroundColor: "#4b2f72",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  actionPrimary: {
    backgroundColor: "#35be88",
    borderColor: "#a8f8bf",
  },
  actionText: { color: "#fff3d5", fontWeight: "bold", fontSize: 15 },
  tabs: { flexDirection: "row", gap: 8, marginVertical: 8 },
  tab: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ad7acc",
    backgroundColor: "#3c235f",
    alignItems: "center",
    justifyContent: "center",
  },
  tabSelected: { backgroundColor: "#ffd36b", borderColor: "#ffd36b" },
  tabText: { color: "#fff3d5", fontWeight: "bold" },
  notice: { color: "#ffe7a0", textAlign: "center", marginVertical: 4 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 24,
    justifyContent: "center",
  },
  card: {
    width: "47%",
    gap: 8,
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#b281cb",
    backgroundColor: "#4a2f6c",
    alignItems: "stretch",
  },
  inUse: { borderWidth: 2, borderColor: "#ffd36b" },
  dicePreview: {
    backgroundColor: "#2c1a48",
    alignItems: "center",
    justifyContent: "center",
  },
  adRow: { gap: 4, marginBottom: 8 },
  preview: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  pawns: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#eee7f5",
    padding: 6,
  },
  name: {
    color: "#fff4df",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 15,
  },
  inUseText: {
    color: "#ffe7a0",
    textAlign: "center",
    minHeight: 44,
    textAlignVertical: "center",
    paddingTop: 10,
  },
});
