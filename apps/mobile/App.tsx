import { useFonts } from "expo-font";
import regularFont from "../../packages/board-geometry/assets/fonts/Samim.ttf";
import boldFont from "../../packages/board-geometry/assets/fonts/Samim-Bold.ttf";
import { Direction, Text, startAlign, useDirection } from "./Theme";
import { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  ImageBackground,
  StatusBar,
  useWindowDimensions,
  Share,
  Modal,
  Linking,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { GameScreen, IconButton, TopBar } from "./GameScreen";
import { RandomMatch, randomDie, randomFloat } from "./RandomMatch";
import {
  applyAction,
  createGame,
  currentPlayer,
  FINISH,
} from "@mench/game-engine";
import { readEconomy, serverReachable } from "@mench/game-client";
import type { CosmeticSku } from "@mench/game-protocol";
import { messages, type Messages } from "@mench/localization";
import backdropArt from "./assets/game/backdrop.png";
import brandPawn from "./assets/game/pawn-0.png";
import { Board } from "./Board";
import { getStored, setStored } from "./storage";
import { Social } from "./Social";
import { History } from "./History";
import { Rankings } from "./Rankings";
import { Wallet } from "./Wallet";
import { Tournaments } from "./Tournaments";
import { Admin } from "./Admin";
import { ResultModal } from "./ResultModal";
import { DemoBoard } from "./DemoBoard";
import {
  Appearance,
  WalletContext,
  newGameId,
  useWallet,
  useWinCoins,
  type Wallet as WalletState,
} from "./coins";
import { CoinChip, DailyModal, FreeCoins, Shop } from "./Shop";
import type {
  BoardThemeId,
  DiceSkinId,
  PawnSetId,
} from "@mench/board-geometry";
import Constants from "expo-constants";
import * as Network from "expo-network";
import { useGameCenter } from "./gameCenter";
import {
  DEFAULT_SERVER,
  EDGE,
  OnlineGame,
  loadName,
  saveName,
  useGameClient,
} from "./OnlineGame";
import { chooseMove, type Difficulty } from "@mench/game-bot";
function Button({
  title,
  onPress,
  disabled = false,
  primary = false,
  selected = false,
  wide = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  selected?: boolean;
  wide?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        wide && { flex: 1 },
        primary && {
          backgroundColor: "#35be88",
          borderColor: "#a8f8bf",
          borderBottomColor: "#177b62",
        },
        selected && {
          backgroundColor: "#ffcf68",
          borderColor: "#ffe8a9",
          borderBottomColor: "#b17832",
        },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          (primary || selected) && { color: "#382a3f" },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
function Input({
  label,
  value,
  onChange,
  password = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  password?: boolean;
  maxLength?: number;
}) {
  const dir = useDirection();
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={password}
        autoCapitalize="none"
        style={[
          styles.input,
          {
            textAlign: startAlign(dir),
          },
        ]}
        maxLength={maxLength ?? (password ? 128 : 254)}
      />
    </View>
  );
}
/** Home menu: display name, language, how to play, privacy, support, version. */
function Menu({
  t,
  visible,
  onClose,
  onLanguage,
  wallet,
  onGameCenter,
}: {
  t: Messages;
  visible: boolean;
  onClose: () => void;
  onLanguage: () => void;
  wallet?: WalletState;
  /** iOS with Game Center signed in: opens its dashboard. */
  onGameCenter?: (() => void) | null;
}) {
  const [restoreCode, setRestoreCode] = useState("");
  const [codeNotice, setCodeNotice] = useState("");
  const [name, setName] = useState("");
  useEffect(() => {
    if (visible) void loadName().then((stored) => setName(stored ?? ""));
  }, [visible]);
  const site = `https://espadna.com/mench-app/${t === messages.fa ? "fa/" : ""}`;
  const dir = useDirection();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.sheetBackdrop, { direction: dir }]}>
        <View style={[styles.sheet, { maxHeight: "92%" }]}>
          <Text style={styles.heading}>{t.menu}</Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            <Input
              label={t.nickname}
              value={name}
              maxLength={24}
              onChange={(value) => {
                setName(value);
                saveName(value);
              }}
            />
            <Text style={styles.fine}>{t.nameHint}</Text>
            <Button title={t.language} onPress={onLanguage} />
            {onGameCenter ? (
              <Button title={t.gameCenter} onPress={onGameCenter} />
            ) : null}
            {wallet?.code ? (
              <View style={{ gap: 10 }}>
                <Text style={styles.heading}>{t.recoveryTitle}</Text>
                <Text style={styles.fine}>{t.recoveryHint}</Text>
                <Text
                  selectable
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={styles.recoveryCode}
                >
                  {wallet.code}
                </Text>
                <Button
                  title={t.shareCode}
                  onPress={() =>
                    void Share.share({
                      message: `${t.recoveryTitle}: ${wallet.code}`,
                    }).catch(() => undefined)
                  }
                />
                <Input
                  label={t.restoreLabel}
                  value={restoreCode}
                  maxLength={24}
                  onChange={setRestoreCode}
                />
                <Button
                  title={t.restore}
                  disabled={wallet.busy || restoreCode.trim().length < 16}
                  onPress={() =>
                    void wallet.recover(restoreCode).then((ok) => {
                      if (ok) setRestoreCode("");
                      setCodeNotice(ok ? t.restored : "");
                    })
                  }
                />
                {codeNotice ||
                wallet.error === "CODE_NOT_FOUND" ||
                wallet.error === "BAD_CODE" ? (
                  <Text style={styles.fine}>
                    {wallet.error === "CODE_NOT_FOUND"
                      ? t.codeNotFound
                      : wallet.error === "BAD_CODE"
                        ? t.badCode
                        : codeNotice}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.heading}>{t.howToPlay}</Text>
            {t.howToPlaySteps.map((step, i) => (
              <Text key={i} style={styles.step}>
                {i + 1}. {step}
              </Text>
            ))}
            <Button
              title={t.privacy}
              onPress={() =>
                void Linking.openURL("https://espadna.com/mench-app/privacy/")
              }
            />
            <Button
              title={t.support}
              onPress={() => void Linking.openURL(site)}
            />
            <Text style={styles.fine}>
              {t.brand} · {t.version} {Constants.expoConfig?.version ?? ""}
            </Text>
          </ScrollView>
          <Button title={t.close} primary onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
function Practice({
  t,
  rtl,
  onBack,
}: {
  t: Messages;
  rtl: boolean;
  onBack: () => void;
}) {
  const [state, setState] = useState(() => createGame(["0", "1"]));
  const [last, setLast] = useState<number | null>(null);
  const [bots, setBots] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [round, setRound] = useState(0);
  const [settings, setSettings] = useState(false);
  const dir = useDirection();
  // Coins only when the bot played every other seat for the whole game.
  const [game, setGame] = useState(() => ({ id: newGameId(), bots: false }));
  const count = state.players.length;
  const finished = state.phase === "finished";
  const winner = state.winner
    ? state.players.find((p) => p.id === state.winner)
    : undefined;
  const reward = useWinCoins(
    t,
    finished ? game.id : null,
    bots && game.bots && state.winner === "0" ? { kind: "bot" } : null,
  );
  function newGame(playerCount = count) {
    setState(
      createGame(Array.from({ length: playerCount }, (_, i) => String(i))),
    );
    setGame({ id: newGameId(), bots });
    setLast(null);
    setRound((r) => r + 1);
  }
  const botTurn =
    bots && state.phase !== "finished" && currentPlayer(state).id !== "0";
  useEffect(() => {
    if (!botTurn) return;
    const timer = setTimeout(() => {
      const playerId = currentPlayer(state).id;
      let next;
      if (state.phase === "roll") {
        const value = randomDie();
        setLast(value);
        next = applyAction(state, { type: "roll", playerId, value });
      } else {
        const pawn = chooseMove(
          state,
          difficulty,
          Math.floor(randomFloat() * 2 ** 31),
        );
        if (pawn === null) return;
        next = applyAction(state, { type: "move", playerId, pawn });
      }
      setState((previous) =>
        previous.version === state.version ? next : previous,
      );
    }, 450);
    return () => clearTimeout(timer);
  }, [botTurn, state, difficulty]);
  const shown =
    state.players[state.winner ? Number(state.winner) : state.turn]!;
  const name = (index: number, seat: number) =>
    bots && index > 0 ? `${t.robotName} · ${t.names[seat]}` : t.names[seat]!;
  return (
    <GameScreen
      t={t}
      rtl={rtl}
      title={t.practice}
      onBack={onBack}
      actions={
        <IconButton
          label={t.settings}
          icon="⚙"
          onPress={() => setSettings(true)}
        />
      }
      board={(size) => (
        <Board
          state={state}
          width={size}
          interactive={!botTurn && !finished}
          onMove={(pawn) =>
            setState((s) =>
              s.phase === "finished"
                ? s
                : applyAction(s, {
                    type: "move",
                    playerId: currentPlayer(s).id,
                    pawn,
                  }),
            )
          }
          t={t}
        />
      )}
      players={state.players.map((p, index) => ({
        key: p.id,
        seat: p.seat,
        name: name(index, p.seat),
        finished: p.pawns.filter((n) => n === FINISH).length,
        current: index === state.turn && !finished,
      }))}
      dice={last}
      status={
        state.phase === "move" && !botTurn && !finished
          ? t.move
          : botTurn && !finished
            ? t.botThinking
            : `${state.winner ? t.winner : t.turn}: ${t.names[shown.seat]}`
      }
      rollDisabled={state.phase !== "roll" || botTurn}
      onRoll={() => {
        const n = randomDie();
        setLast(n);
        setState((s) =>
          s.phase === "roll"
            ? applyAction(s, {
                type: "roll",
                playerId: currentPlayer(s).id,
                value: n,
              })
            : s,
        );
      }}
    >
      {finished && winner && (
        <ResultModal
          key={round}
          t={t}
          winnerName={
            bots && winner.id !== "0"
              ? `${t.robotName} · ${t.names[winner.seat]}`
              : t.names[winner.seat]!
          }
          won={bots ? winner.id === "0" : undefined}
          reward={reward}
          onPlayAgain={() => newGame()}
        />
      )}
      <Modal
        visible={settings}
        transparent
        animationType="fade"
        onRequestClose={() => setSettings(false)}
      >
        <View style={[styles.sheetBackdrop, { direction: dir }]}>
          <View style={styles.sheet}>
            <Text style={styles.heading}>{t.settings}</Text>
            <View style={styles.row}>
              {[2, 3, 4].map((n) => (
                <Button
                  key={n}
                  title={[t.two, t.three, t.four][n - 2]!}
                  selected={count === n}
                  onPress={() => newGame(n)}
                />
              ))}
            </View>
            <Button
              title={`${bots ? "✓ " : ""}${t.bot}`}
              onPress={() => {
                setBots(!bots);
                // Turning the bot on counts only before the first roll.
                setGame((g) => ({ ...g, bots: !bots && state.version === 0 }));
              }}
            />
            {bots && (
              <>
                <Text style={styles.fine}>{t.botHint}</Text>
                <View style={styles.row}>
                  {(["easy", "normal", "hard"] as const).map((level) => (
                    <Button
                      key={level}
                      title={`${difficulty === level ? "✓ " : ""}${t[level]}`}
                      onPress={() => setDifficulty(level)}
                    />
                  ))}
                </View>
              </>
            )}
            <Button
              title={t.newGame}
              onPress={() => {
                newGame();
                setSettings(false);
              }}
            />
            <Button
              title={t.close}
              primary
              onPress={() => setSettings(false)}
            />
          </View>
        </View>
      </Modal>
    </GameScreen>
  );
}
function Online({
  t,
  rtl,
  onBack,
  server,
  token,
  inviteCode,
}: {
  t: Messages;
  rtl: boolean;
  onBack: () => void;
  server: string;
  token: string | null;
  inviteCode: string;
}) {
  const online = useGameClient({ t, server, token });
  const { snapshot, client: ref, notice, setNotice } = online;
  const [name, setNameState] = useState(t.guest);
  const setName = (value: string) => {
    setNameState(value);
    saveName(value);
  };
  useEffect(() => {
    void loadName().then((stored) => stored && setNameState(stored));
  }, []);
  const [code, setCode] = useState(inviteCode);
  const [ranked, setRanked] = useState(false);
  const [capacity, setCapacity] = useState(2);
  const { room, connected, busy, queued, playerId, error } = snapshot;
  const status = (
    <Text
      accessibilityLiveRegion="polite"
      style={connected ? undefined : styles.disconnected}
    >
      {connected ? t.connected : t.reconnecting}
    </Text>
  );
  const errorView = error ? (
    <Text style={styles.error}>{t.errors[error] ?? t.error}</Text>
  ) : null;
  const leave = () => void ref.current?.send({ type: "leave" });
  // Opened from a friend's invite link: only a name and "join" are needed.
  if (!room && inviteCode.length === 10)
    return (
      <View style={styles.page}>
        <TopBar t={t} title={t.online} onBack={onBack} rtl={rtl} />
        <View style={styles.lobby}>
          {status}
          <Text style={styles.heading}>{t.join}</Text>
          <Input
            label={t.nickname}
            value={name}
            onChange={setName}
            maxLength={24}
          />
          <Button
            title={t.join}
            primary
            disabled={!connected || busy || !name.trim()}
            onPress={() =>
              void ref.current?.send({ type: "join", name, code: inviteCode })
            }
          />
          {errorView}
          {notice ? <Text>{notice}</Text> : null}
        </View>
      </View>
    );
  if (!room)
    return (
      <View style={styles.page}>
        <TopBar t={t} title={t.online} onBack={onBack} rtl={rtl} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.lobby}
        >
          {status}
          <Input
            label={t.nickname}
            value={name}
            onChange={setName}
            maxLength={24}
          />
          <View style={styles.row}>
            {[2, 3, 4].map((n) => (
              <Button
                key={n}
                title={[t.two, t.three, t.four][n - 2]!}
                selected={capacity === n}
                onPress={() => setCapacity(n)}
              />
            ))}
          </View>
          <Button
            title={t.create}
            disabled={!connected || busy || queued}
            onPress={() =>
              void ref.current?.send({ type: "create", name, capacity })
            }
          />
          <Input
            label={t.code}
            value={code}
            onChange={(s) => setCode(s.toUpperCase())}
          />
          <Button
            title={t.join}
            disabled={!connected || busy || code.length !== 10 || queued}
            onPress={() => void ref.current?.send({ type: "join", name, code })}
          />
          {!EDGE && (
            <Button
              title={queued ? t.cancel : t.matchmaking}
              disabled={!connected || busy}
              onPress={() =>
                void ref.current?.send(
                  queued
                    ? { type: "cancelQueue" }
                    : { type: "queue", name, ranked },
                )
              }
            />
          )}
          {!EDGE && (
            <Button
              title={`${ranked ? "✓ " : ""}${t.ranked}`}
              disabled={queued || busy}
              onPress={() => setRanked(!ranked)}
            />
          )}
          {ranked && <Text>{t.rankedHint}</Text>}
          {errorView}
          {notice ? <Text>{notice}</Text> : null}
        </ScrollView>
      </View>
    );
  if (!room.state)
    return (
      <View style={styles.page}>
        <TopBar t={t} title={t.online} onBack={leave} rtl={rtl} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.lobby}
        >
          {status}
          <Text style={styles.heading}>{t.waiting}</Text>
          <Text selectable style={styles.code}>
            {room.code}
          </Text>
          {room.ranked && <Text>{t.ranked}</Text>}
          {room.players.map((p) => (
            <Text key={p.id}>
              {p.name} · {p.connected ? t.connected : t.disconnected}
            </Text>
          ))}
          <Button
            title={t.copy}
            onPress={() =>
              void Share.share({
                message: `${t.inviteText} ${server}/join/${room.code}`,
              }).catch(() => setNotice(`${server}/join/${room.code}`))
            }
          />
          <Button
            title={t.start}
            primary
            disabled={
              room.hostId !== playerId ||
              room.players.length !== room.capacity ||
              busy
            }
            onPress={() => void ref.current?.send({ type: "start" })}
          />
          {notice ? <Text>{notice}</Text> : null}
          {errorView}
          <Button title={t.leave} onPress={leave} />
        </ScrollView>
      </View>
    );
  return (
    <OnlineGame
      t={t}
      rtl={rtl}
      online={online}
      title={t.online}
      onExit={() => {
        leave();
        onBack();
      }}
    />
  );
}
interface Profile {
  id: string;
  name: string;
  email: string;
}
function Account({
  t,
  server,
  token,
  onToken,
  onInvite,
  onTheme,
}: {
  t: Messages;
  server: string;
  token: string | null;
  onToken: (token: string | null) => void;
  onInvite: (code: string) => void;
  onTheme: (sku: CosmeticSku | null) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token) {
      setProfile(null);
      return;
    }
    if (token)
      void fetch(`${server}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (r) => {
          if (r.ok) setProfile((await r.json()) as Profile);
          else {
            await setStored("mench-account", null);
            onToken(null);
            setProfile(null);
          }
        })
        .catch(() => setNotice(t.error));
  }, [token, server, t.error, onToken]);
  async function action(kind: "register" | "login" | "logout") {
    setBusy(true);
    try {
      const response = await fetch(`${server}/api/auth/${kind}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-platform": "mobile",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(
          kind === "register"
            ? { name, email, password }
            : kind === "login"
              ? { email, password }
              : {},
        ),
      });
      if (!response.ok) {
        const problem = (await response.json()) as { error?: string };
        setNotice(t.errors[problem.error ?? "REQUEST_FAILED"] ?? t.error);
        return;
      }
      if (kind === "login") {
        const data = (await response.json()) as { token: string };
        await setStored("mench-account", data.token);
        onToken(data.token);
        setPassword("");
      } else if (kind === "logout") {
        await setStored("mench-account", null);
        onToken(null);
        setProfile(null);
      } else setNotice(t.registered);
    } catch {
      setNotice(t.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {profile ? (
        <>
          <Text style={styles.heading}>{profile.name}</Text>
          <Text>{profile.email}</Text>
          <Text selectable>
            {t.accountId}: {profile.id}
          </Text>
          <Social t={t} server={server} token={token} onInvite={onInvite} />
          <Rankings t={t} server={server} token={token} />
          <History t={t} server={server} token={token} />
          <Wallet t={t} server={server} token={token} onTheme={onTheme} />
          <Tournaments
            t={t}
            userId={profile.id}
            server={server}
            token={token}
            onInvite={onInvite}
          />
          <Admin t={t} server={server} token={token} />
          <Button
            title={t.logout}
            disabled={busy}
            onPress={() => void action("logout")}
          />
        </>
      ) : (
        <>
          <Input
            label={t.nickname}
            value={name}
            onChange={setName}
            maxLength={24}
          />
          <Input label={t.email} value={email} onChange={setEmail} />
          <Input
            label={t.password}
            value={password}
            onChange={setPassword}
            password
          />
          <Button
            title={t.login}
            disabled={busy || password.length < 12}
            onPress={() => void action("login")}
          />
          <Button
            title={t.register}
            disabled={busy || password.length < 12 || !name}
            onPress={() => void action("register")}
          />
        </>
      )}
      {notice && <Text>{notice}</Text>}
    </>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}
const LOCALE_KEY = "mench-locale";
type Mode =
  "home" | "random" | "online" | "practice" | "account" | "shop" | "free";
function Root() {
  const [fontsLoaded, fontError] = useFonts({
    Samim: regularFont,
    SamimBold: boldFont,
  });
  const [locale, setLocaleState] = useState<"fa" | "en">("fa");
  // The chosen language survives restarts.
  useEffect(() => {
    void getStored(LOCALE_KEY)
      .then((saved) => {
        if (saved === "en" || saved === "fa") setLocaleState(saved);
      })
      .catch(() => undefined);
  }, []);
  const setLocale = (next: "fa" | "en") => {
    setLocaleState(next);
    void setStored(LOCALE_KEY, next).catch(() => undefined);
  };
  const [mode, setMode] = useState<Mode>("home");
  const wallet = useWallet();
  const gameCenter = useGameCenter(wallet.wallet);
  // Online modes need the network; say so instead of a screen that never connects.
  const network = Network.useNetworkState();
  const offline =
    network.isConnected === false || network.isInternetReachable === false;
  const [noInternet, setNoInternet] = useState(false);
  useEffect(() => {
    if (!offline) setNoInternet(false);
  }, [offline]);
  const [checking, setChecking] = useState(false);
  const openMode = (key: Mode) => {
    if (key !== "random" && key !== "online") {
      setMode(key);
      return;
    }
    if (offline) {
      setNoInternet(true);
      return;
    }
    // Wi-Fi without internet still reads as connected: ask the game server.
    setChecking(true);
    void serverReachable(
      `${DEFAULT_SERVER}${EDGE ? "/healthz" : "/health"}`,
    ).then((reachable) => {
      setChecking(false);
      setNoInternet(!reachable);
      if (reachable) setMode(key);
    });
  };
  const look = {
    board: (wallet.wallet?.equipped.board ?? "classic") as BoardThemeId,
    pawns: (wallet.wallet?.equipped.pawns ?? "classic") as PawnSetId,
    dice: (wallet.wallet?.equipped.dice ?? "classic") as DiceSkinId,
  };
  const [menu, setMenu] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [draft, setDraft] = useState(server);
  const [token, setToken] = useState<string | null>(null);
  const [theme, setTheme] = useState<CosmeticSku | null>(null);
  const [storageError, setStorageError] = useState(false);
  const insets = useSafeAreaInsets();
  // iPad and an unfolded foldable iPhone: a wider column and larger type.
  const window = useWindowDimensions();
  const wide = Math.min(window.width, window.height) >= 600;
  const t = messages[locale];
  const rtl = locale === "fa";
  const home = () => setMode("home");
  useEffect(() => {
    void getStored("mench-account")
      .then(setToken)
      .catch(() => setStorageError(true));
  }, []);
  useEffect(() => {
    if (!token) {
      setTheme(null);
      return;
    }
    void readEconomy({ url: server, token })
      .then((data) => setTheme(data.active))
      .catch(() => setTheme(null));
  }, [token, server]);
  if (!fontsLoaded && !fontError) return null;
  const modes: [Mode, string, string, string][] = [
    ["random", "🌍", t.random, t.randomHint],
    ["online", "🔗", t.online, t.friendsHint],
    ["practice", "🎲", t.practice, t.practiceHint],
    ...(EDGE
      ? []
      : [["account", "👤", t.signIn, ""] as [Mode, string, string, string]]),
  ];
  return (
    <Direction.Provider value={rtl ? "rtl" : "ltr"}>
      <WalletContext.Provider value={wallet.enabled ? wallet : null}>
        <Appearance.Provider value={look}>
          <ImageBackground
            source={backdropArt}
            style={{
              flex: 1,
              width: "100%",
              overflow: "hidden",
              backgroundColor: "#26164a",
            }}
            resizeMode="cover"
          >
            <StatusBar barStyle="light-content" />
            <View
              style={[
                styles.root,
                {
                  paddingTop: insets.top + 6,
                  paddingBottom: Math.max(insets.bottom, 10),
                  paddingLeft: insets.left,
                  paddingRight: insets.right,
                  direction: rtl ? "rtl" : "ltr",
                },
                theme && {
                  backgroundColor:
                    theme === "aurora" ? "#173344cc" : "#482446cc",
                },
              ]}
            >
              {mode === "home" ? (
                <View style={[styles.home, wide && styles.homeWide]}>
                  <View style={styles.header}>
                    <View style={styles.brand}>
                      <Image
                        source={brandPawn}
                        style={[
                          styles.brandPawn,
                          wide && { width: 32, height: 40 },
                        ]}
                        accessibilityIgnoresInvertColors
                      />
                      <Text
                        style={[styles.title, wide && { fontSize: 38 }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {t.brand}
                      </Text>
                    </View>
                    {wallet.enabled && (
                      <CoinChip
                        t={t}
                        coins={wallet.wallet?.coins ?? null}
                        onPress={() => setMode("shop")}
                      />
                    )}
                    <IconButton
                      label={t.menu}
                      icon="☰"
                      onPress={() => setMenu(true)}
                    />
                  </View>
                  {wallet.enabled ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t.freeCoins}
                      onPress={() => setMode("free")}
                      style={[styles.freeButton, wide && { minHeight: 72 }]}
                    >
                      <Text style={styles.freeIcon}>🎁</Text>
                      <Text style={[styles.freeText, wide && { fontSize: 24 }]}>
                        {t.freeCoins}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={[styles.fine, wide && { fontSize: 15 }]}>
                      {t.tagline}
                    </Text>
                  )}
                  {modes.map(([key, icon, title, hint]) => (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={title}
                      onPress={() => openMode(key)}
                      style={[
                        styles.mode,
                        wide && { minHeight: 100, paddingHorizontal: 22 },
                        key === "random" && styles.modeRandom,
                        offline &&
                          (key === "random" || key === "online") && {
                            opacity: 0.55,
                          },
                      ]}
                    >
                      <Text
                        style={[styles.modeIcon, wide && styles.modeIconWide]}
                      >
                        {icon}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.modeTitle, wide && { fontSize: 24 }]}
                        >
                          {title}
                        </Text>
                        {hint ? (
                          <Text
                            style={[styles.modeHint, wide && { fontSize: 16 }]}
                          >
                            {hint}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                  {checking ? (
                    <Text style={styles.fine}>{t.checkingInternet}</Text>
                  ) : noInternet ? (
                    <Text style={styles.noInternet} accessibilityRole="alert">
                      {t.noInternet}
                    </Text>
                  ) : null}
                  {storageError && <Text>{t.secureStorage}</Text>}
                  <DemoBoard t={t} />
                  {wallet.enabled && <DailyModal t={t} wallet={wallet} />}
                  <Menu
                    t={t}
                    visible={menu}
                    onClose={() => setMenu(false)}
                    onLanguage={() => setLocale(rtl ? "en" : "fa")}
                    {...(wallet.enabled ? { wallet } : {})}
                    onGameCenter={gameCenter}
                  />
                </View>
              ) : mode === "practice" ? (
                <Practice t={t} rtl={rtl} onBack={home} />
              ) : mode === "random" ? (
                <RandomMatch
                  t={t}
                  rtl={rtl}
                  onBack={home}
                  server={server}
                  token={token}
                />
              ) : mode === "shop" ? (
                <Shop t={t} rtl={rtl} wallet={wallet} onBack={home} />
              ) : mode === "free" ? (
                <FreeCoins t={t} rtl={rtl} wallet={wallet} onBack={home} />
              ) : mode === "online" ? (
                <Online
                  t={t}
                  rtl={rtl}
                  onBack={home}
                  server={server}
                  token={token}
                  inviteCode={inviteCode}
                />
              ) : (
                <View style={styles.page}>
                  <TopBar t={t} title={t.signIn} onBack={home} rtl={rtl} />
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.lobby}
                  >
                    <Input label={t.server} value={draft} onChange={setDraft} />
                    <Button
                      title={t.reconnect}
                      onPress={() => {
                        if (/^https?:\/\//.test(draft))
                          setServer(draft.replace(/\/$/, ""));
                      }}
                    />
                    <Account
                      t={t}
                      server={server}
                      token={token}
                      onToken={setToken}
                      onTheme={setTheme}
                      onInvite={(code) => {
                        setInviteCode(code);
                        setMode("online");
                      }}
                    />
                  </ScrollView>
                </View>
              )}
            </View>
          </ImageBackground>
        </Appearance.Provider>
      </WalletContext.Provider>
    </Direction.Provider>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center" },
  home: {
    flex: 1,
    width: "100%",
    maxWidth: 540,
    paddingHorizontal: 16,
    gap: 12,
  },
  homeWide: { maxWidth: 720, gap: 18 },
  freeButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#f6c343",
    borderBottomWidth: 4,
    borderBottomColor: "#b9790b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  freeIcon: { fontSize: 24, lineHeight: 32 },
  freeText: { color: "#3b2463", fontSize: 19, fontWeight: "bold" },
  modeIconWide: { fontSize: 46, lineHeight: 58 },
  mode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 76,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#b48acb",
    borderBottomWidth: 5,
    borderBottomColor: "#33204e",
    backgroundColor: "#56377e",
  },
  modeRandom: {
    backgroundColor: "#28a477",
    borderColor: "#a8f8bf",
    borderBottomColor: "#145c44",
  },
  modeIcon: { fontSize: 34, lineHeight: 44 },
  modeTitle: { fontSize: 18, fontWeight: "bold", color: "#fff4df" },
  modeHint: { fontSize: 12, color: "#f1e5ff" },
  // Same side gutters as the game screen; nothing touches the screen edge.
  page: { flex: 1, width: "100%", paddingHorizontal: 12 },
  lobby: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    padding: 4,
    paddingBottom: 24,
    gap: 12,
  },
  code: { fontSize: 28, letterSpacing: 4, textAlign: "center" },
  sheetBackdrop: {
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
  },
  screen: {
    flexGrow: 1,
    alignItems: "center",
    padding: 16,
    paddingTop: 44,
    paddingBottom: 48,
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  step: { fontSize: 14, lineHeight: 24, color: "#f4e9ff" },
  disconnected: {
    color: "#fff",
    fontWeight: "bold",
    backgroundColor: "#a8323a",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: "hidden",
  },
  noInternet: {
    color: "#fff",
    fontWeight: "bold",
    backgroundColor: "#a8323a",
    borderRadius: 14,
    padding: 12,
    textAlign: "center",
  },
  recoveryCode: {
    fontSize: 20,
    letterSpacing: 1,
    textAlign: "center",
    color: "#ffe7a0",
    backgroundColor: "#2c1a48",
    borderRadius: 14,
    padding: 12,
    writingDirection: "ltr",
  },
  brand: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  brandPawn: { width: 24, height: 30 },
  title: {
    flexShrink: 1,
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffe7a0",
    textShadowColor: "#693861",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 1,
  },
  heading: { fontSize: 18, fontWeight: "bold", color: "#fff4df" },
  row: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
  },
  button: {
    backgroundColor: "#63418c",
    borderWidth: 1,
    borderColor: "#b48acb",
    borderBottomWidth: 4,
    borderBottomColor: "#33204e",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff2d7", fontSize: 12, fontWeight: "bold" },
  input: {
    fontFamily: "Samim",
    borderWidth: 1,
    borderColor: "#946aad",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#2d1c48",
    color: "#fff4df",
  },
  label: { fontSize: 12, color: "#dbc9ed", marginBottom: 6 },
  rollControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    paddingHorizontal: 8,
  },
  fine: { fontSize: 11, lineHeight: 20, color: "#dbc9ed" },
  error: { color: "#ffb6be" },
  playerCards: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  playerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2a193fbb",
    borderWidth: 1,
    borderColor: "#9d72b8",
    borderRadius: 14,
    padding: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#fff0c5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "white", fontWeight: "bold", fontSize: 12 },
  playerName: { color: "#fff2dc", fontSize: 11 },
});
