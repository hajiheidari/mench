import { useFonts } from "expo-font";
import regularFont from "../../packages/board-geometry/assets/fonts/Samim.ttf";
import boldFont from "../../packages/board-geometry/assets/fonts/Samim-Bold.ttf";
import { Text } from "./Theme";
import { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ImageBackground,
  StatusBar,
  Share,
  Modal,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { GameScreen, IconButton, TopBar } from "./GameScreen";
import { RandomMatch, randomDie, randomFloat } from "./RandomMatch";
import * as Crypto from "expo-crypto";
import {
  applyAction,
  createGame,
  currentPlayer,
  FINISH,
} from "@mench/game-engine";
import {
  GameClient,
  readEconomy,
  type ClientState,
  type Session,
} from "@mench/game-client";
import type { CosmeticSku } from "@mench/game-protocol";
import { messages, type Messages } from "@mench/localization";
import { verifyProof } from "@mench/fair-dice/portable";
import backdropArt from "./assets/game/backdrop.png";
import { Board } from "./Board";
import { getStored, setStored } from "./storage";
import { Social } from "./Social";
import { History } from "./History";
import { Rankings } from "./Rankings";
import { Wallet } from "./Wallet";
import { Tournaments } from "./Tournaments";
import { Admin } from "./Admin";
import { ResultModal } from "./ResultModal";
/**
 * Store and web builds set EXPO_PUBLIC_BACKEND=edge: casual online rooms on
 * mench.espadna.com (Cloudflare). Accounts need the full Node API and stay hidden.
 */
const EDGE = process.env.EXPO_PUBLIC_BACKEND === "edge";
const DEFAULT_SERVER =
  process.env.EXPO_PUBLIC_API_URL ??
  (EDGE ? "https://mench.espadna.com" : "http://127.0.0.1:3001");
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
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  password?: boolean;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={password}
        autoCapitalize="none"
        style={styles.input}
        maxLength={password ? 128 : 254}
      />
    </View>
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
  const count = state.players.length;
  const finished = state.phase === "finished";
  const winner = state.winner
    ? state.players.find((p) => p.id === state.winner)
    : undefined;
  function newGame(playerCount = count) {
    setState(
      createGame(Array.from({ length: playerCount }, (_, i) => String(i))),
    );
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
          onPlayAgain={() => newGame()}
        />
      )}
      <Modal
        visible={settings}
        transparent
        animationType="fade"
        onRequestClose={() => setSettings(false)}
      >
        <View style={styles.sheetBackdrop}>
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
              onPress={() => setBots(!bots)}
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
  const ref = useRef<GameClient | null>(null);
  const [snapshot, setSnapshot] = useState<ClientState>({
    room: null,
    playerId: null,
    connected: false,
    queued: false,
    busy: false,
    error: "",
  });
  const [name, setName] = useState(t.guest);
  const [code, setCode] = useState(inviteCode);
  const [ranked, setRanked] = useState(false);
  const [capacity, setCapacity] = useState(2);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    let stop: (() => void) | undefined;
    void getStored("mench-room")
      .then((raw) => {
        if (!live) return;
        let session: Session | null = null;
        if (raw)
          try {
            session = JSON.parse(raw) as Session;
          } catch {
            setNotice(t.error);
          }
        const client = new GameClient({
          url: server,
          transport: EDGE ? "websocket" : "socket.io",
          requestId: Crypto.randomUUID,
          session,
          ...(token ? { token } : {}),
          save: (value) => {
            void setStored(
              "mench-room",
              value ? JSON.stringify(value) : null,
            ).catch(() => setNotice(t.secureStorage));
          },
        });
        ref.current = client;
        stop = client.subscribe(setSnapshot);
        client.connect();
      })
      .catch(() => setNotice(t.secureStorage));
    return () => {
      live = false;
      stop?.();
      ref.current?.close();
      ref.current = null;
    };
  }, [server, token, t.error, t.secureStorage]);
  const { room, connected, busy, queued, playerId, error } = snapshot;
  const status = (
    <Text accessibilityLiveRegion="polite">
      {connected ? t.connected : t.reconnecting}
    </Text>
  );
  const leave = () => void ref.current?.send({ type: "leave" });
  if (!room)
    return (
      <View style={{ flex: 1, width: "100%" }}>
        <TopBar t={t} title={t.online} onBack={onBack} rtl={rtl} />
        <ScrollView contentContainerStyle={styles.lobby}>
          {status}
          <Input label={t.nickname} value={name} onChange={setName} />
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
          {error && (
            <Text style={styles.error}>{t.errors[error] ?? t.error}</Text>
          )}
          {notice && <Text>{notice}</Text>}
        </ScrollView>
      </View>
    );
  const state = room.state;
  const mine =
    state &&
    state.phase !== "finished" &&
    currentPlayer(state).id === playerId &&
    connected &&
    !busy;
  const winner = state?.winner
    ? room.players.find((p) => p.id === state.winner)
    : undefined;
  // Guests often keep the default nickname; colour and "(you)" keep players apart.
  const label = (id: string | null | undefined) => {
    const index = room.players.findIndex((p) => p.id === id);
    const player = room.players[index];
    const seat = state?.players[index]?.seat;
    if (!player || seat === undefined) return player?.name ?? "";
    return `${t.names[seat]} · ${player.name}${id === playerId ? ` (${t.you})` : ""}`;
  };
  if (!state)
    return (
      <View style={{ flex: 1, width: "100%" }}>
        <TopBar t={t} title={t.online} onBack={leave} rtl={rtl} />
        <ScrollView contentContainerStyle={styles.lobby}>
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
          {notice && <Text>{notice}</Text>}
          {error && (
            <Text style={styles.error}>{t.errors[error] ?? t.error}</Text>
          )}
          <Button title={t.leave} onPress={leave} />
        </ScrollView>
      </View>
    );
  const active = state.winner ?? currentPlayer(state).id;
  const proof = room.proofs.at(-1);
  return (
    <GameScreen
      t={t}
      rtl={rtl}
      title={t.online}
      onBack={() => {
        leave();
        onBack();
      }}
      actions={
        proof ? (
          <IconButton
            label={t.verify}
            icon="✔"
            onPress={() => {
              const observed = ref.current?.commitments.get(proof.commitment);
              setNotice(
                !observed
                  ? t.unwitnessed
                  : verifyProof(
                        proof,
                        observed,
                        ref.current?.nonces.get(proof.commitment) ??
                          proof.nonce,
                      )
                    ? t.verified
                    : t.invalidProof,
              );
            }}
          />
        ) : undefined
      }
      board={(size) => (
        <Board
          state={state}
          width={size}
          t={t}
          interactive={Boolean(mine)}
          onMove={(pawn) =>
            void ref.current?.send({
              type: "move",
              pawn,
              expectedVersion: state.version,
            })
          }
        />
      )}
      players={room.players.map((p, index) => ({
        key: p.id,
        seat: state.players[index]!.seat,
        name: `${p.name}${p.id === playerId ? ` (${t.you})` : ""}`,
        finished: state.players[index]!.pawns.filter((n) => n === FINISH)
          .length,
        current: p.id === active && state.phase !== "finished",
      }))}
      dice={state.dice ?? proof?.value ?? null}
      status={
        mine && state.phase === "move"
          ? t.move
          : `${state.winner ? t.winner : t.turn}: ${label(active)}`
      }
      info={
        <>
          {status}
          {notice ? (
            <Text accessibilityLiveRegion="polite">{notice}</Text>
          ) : null}
          {error ? (
            <Text style={styles.error}>{t.errors[error] ?? t.error}</Text>
          ) : null}
        </>
      }
      rollDisabled={!mine || state.phase !== "roll" || !room.commitment}
      onRoll={() => {
        const nonce = Array.from(Crypto.getRandomBytes(32), (v) =>
          v.toString(16).padStart(2, "0"),
        ).join("");
        ref.current?.nonces.set(room.commitment!.hash, nonce);
        void ref.current?.send({
          type: "roll",
          nonce,
          expectedVersion: state.version,
        });
      }}
    >
      {state.phase === "finished" && winner && (
        <ResultModal
          key={room.matchId ?? room.code}
          t={t}
          winnerName={label(winner.id)}
          won={state.winner === playerId}
        />
      )}
    </GameScreen>
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
          <Input label={t.nickname} value={name} onChange={setName} />
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
type Mode = "home" | "random" | "online" | "practice" | "account";
function Root() {
  const [fontsLoaded, fontError] = useFonts({
    Samim: regularFont,
    SamimBold: boldFont,
  });
  const [locale, setLocale] = useState<"fa" | "en">("fa");
  const [mode, setMode] = useState<Mode>("home");
  const [inviteCode, setInviteCode] = useState("");
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [draft, setDraft] = useState(server);
  const [token, setToken] = useState<string | null>(null);
  const [theme, setTheme] = useState<CosmeticSku | null>(null);
  const [storageError, setStorageError] = useState(false);
  const insets = useSafeAreaInsets();
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
    <ImageBackground
      source={backdropArt}
      style={{ flex: 1, overflow: "hidden" }}
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
            backgroundColor: theme === "aurora" ? "#173344cc" : "#482446cc",
          },
        ]}
      >
        {mode === "home" ? (
          <View style={styles.home}>
            <View style={styles.row}>
              <Text style={styles.title}>{t.brand} ✦</Text>
              <Button
                title={t.language}
                onPress={() => setLocale(rtl ? "en" : "fa")}
              />
            </View>
            <Text style={styles.fine}>{t.tagline}</Text>
            {modes.map(([key, icon, title, hint]) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={title}
                onPress={() => setMode(key)}
                style={[styles.mode, key === "random" && styles.modeRandom]}
              >
                <Text style={styles.modeIcon}>{icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeTitle}>{title}</Text>
                  {hint ? <Text style={styles.modeHint}>{hint}</Text> : null}
                </View>
              </Pressable>
            ))}
            {storageError && <Text>{t.secureStorage}</Text>}
          </View>
        ) : mode === "practice" ? (
          <Practice t={t} rtl={rtl} onBack={home} />
        ) : mode === "random" ? (
          <RandomMatch t={t} rtl={rtl} onBack={home} />
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
          <View style={{ flex: 1, width: "100%" }}>
            <TopBar t={t} title={t.signIn} onBack={home} rtl={rtl} />
            <ScrollView contentContainerStyle={styles.lobby}>
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
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center" },
  home: { width: "100%", maxWidth: 540, paddingHorizontal: 16, gap: 14 },
  mode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 92,
    padding: 16,
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
  lobby: {
    width: "100%",
    maxWidth: 540,
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
  title: {
    fontSize: 32,
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
