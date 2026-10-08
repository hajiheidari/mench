import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  useWindowDimensions,
} from "react-native";
import * as Crypto from "expo-crypto";
import {
  applyAction,
  createGame,
  currentPlayer,
  legalMoves,
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
import { Board } from "./Board";
import { getStored, setStored } from "./storage";
import { Social } from "./Social";
import { History } from "./History";
import { Rankings } from "./Rankings";
import { Wallet } from "./Wallet";
import { Tournaments } from "./Tournaments";
import { Admin } from "./Admin";
import { chooseMove, type Difficulty } from "@mench/game-bot";
function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && { opacity: 0.45 }]}
    >
      <Text style={styles.buttonText}>{title}</Text>
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
function Practice({ t, width }: { t: Messages; width: number }) {
  const [count, setCount] = useState(2);
  const [state, setState] = useState(() => createGame(["0", "1"]));
  const [last, setLast] = useState<number | null>(null);
  const [bots, setBots] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const botTurn =
    bots && state.phase !== "finished" && currentPlayer(state).id !== "0";
  useEffect(() => {
    if (!botTurn) return;
    const timer = setTimeout(() => {
      const playerId = currentPlayer(state).id;
      let next;
      if (state.phase === "roll") {
        let value: number;
        do {
          value = Crypto.getRandomBytes(1)[0]!;
        } while (value >= 252);
        value = (value % 6) + 1;
        setLast(value);
        next = applyAction(state, { type: "roll", playerId, value });
      } else {
        const pawn = chooseMove(
          state,
          difficulty,
          Crypto.getRandomBytes(1)[0]!,
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
  return (
    <>
      <Text style={styles.heading}>
        {state.winner ? t.winner : t.turn}:{" "}
        {
          t.names[
            state.players[state.winner ? Number(state.winner) : state.turn]!
              .seat
          ]
        }
      </Text>
      <Board
        state={state}
        width={width}
        interactive={!botTurn}
        onMove={(pawn) =>
          setState((s) =>
            applyAction(s, {
              type: "move",
              playerId: currentPlayer(s).id,
              pawn,
            }),
          )
        }
        t={t}
      />
      <Text style={styles.dice}>{last ?? "✦"}</Text>
      <Button
        title={t.roll}
        disabled={state.phase !== "roll" || botTurn}
        onPress={() => {
          let n: number;
          do {
            n = Crypto.getRandomBytes(1)[0]!;
          } while (n >= 252);
          n = (n % 6) + 1;
          setLast(n);
          setState((s) =>
            applyAction(s, {
              type: "roll",
              playerId: currentPlayer(s).id,
              value: n,
            }),
          );
        }}
      />
      {state.phase === "move" && !botTurn && (
        <Text>
          {t.move} ({legalMoves(state).length})
        </Text>
      )}
      {botTurn && <Text>{t.botThinking}</Text>}
      <Button
        title={`${bots ? "✓ " : ""}${t.bot}`}
        onPress={() => setBots(!bots)}
      />
      {bots && (
        <>
          <Text>{t.botHint}</Text>
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
      <View style={styles.row}>
        {[2, 3, 4].map((n) => (
          <Button
            key={n}
            title={[t.two, t.three, t.four][n - 2]!}
            onPress={() => setCount(n)}
          />
        ))}
      </View>
      <Button
        title={t.newGame}
        onPress={() => {
          setState(
            createGame(Array.from({ length: count }, (_, i) => String(i))),
          );
          setLast(null);
        }}
      />
      <Text style={styles.fine}>{t.hint}</Text>
    </>
  );
}
function Online({
  t,
  width,
  server,
  token,
  inviteCode,
}: {
  t: Messages;
  width: number;
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
  if (!room)
    return (
      <>
        {status}
        <Input label={t.nickname} value={name} onChange={setName} />
        <View style={styles.row}>
          {[2, 3, 4].map((n) => (
            <Button
              key={n}
              title={[t.two, t.three, t.four][n - 2]!}
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
        <Button
          title={`${ranked ? "✓ " : ""}${t.ranked}`}
          disabled={queued || busy}
          onPress={() => setRanked(!ranked)}
        />
        {ranked && <Text>{t.rankedHint}</Text>}
        {error && (
          <Text style={styles.error}>{t.errors[error] ?? t.error}</Text>
        )}
        {notice && <Text>{notice}</Text>}
      </>
    );
  const state = room.state;
  const mine =
    state &&
    state.phase !== "finished" &&
    currentPlayer(state).id === playerId &&
    connected &&
    !busy;
  return (
    <>
      {status}
      <Text style={styles.heading}>
        {state
          ? (state.winner ? t.winner : t.turn) +
            ": " +
            (room.players.find(
              (p) => p.id === (state.winner ?? currentPlayer(state).id),
            )?.name ?? "")
          : t.waiting}
      </Text>
      <Text selectable>{room.code}</Text>
      {room.ranked && <Text>{t.ranked}</Text>}
      {!state &&
        room.players.map((p) => (
          <Text key={p.id}>
            {p.name} · {p.connected ? t.connected : t.disconnected}
          </Text>
        ))}
      {!state && (
        <Button
          title={t.start}
          disabled={
            room.hostId !== playerId ||
            room.players.length !== room.capacity ||
            busy
          }
          onPress={() => void ref.current?.send({ type: "start" })}
        />
      )}{" "}
      {state && (
        <>
          <Board
            state={state}
            width={width}
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
          <Text style={styles.dice}>
            {state.dice ?? room.proofs.at(-1)?.value ?? "✦"}
          </Text>
          <Button
            title={t.roll}
            disabled={!mine || state.phase !== "roll" || !room.commitment}
            onPress={() => {
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
          />
          {room.proofs.at(-1) && (
            <Button
              title={t.verify}
              onPress={() => {
                const proof = room.proofs.at(-1)!;
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
          )}
        </>
      )}
      {notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
      {error && <Text style={styles.error}>{t.errors[error] ?? t.error}</Text>}
      <Button
        title={t.leave}
        onPress={() => void ref.current?.send({ type: "leave" })}
      />
    </>
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
  const [locale, setLocale] = useState<"fa" | "en">("fa");
  const [mode, setMode] = useState("practice");
  const [inviteCode, setInviteCode] = useState("");
  const [server, setServer] = useState(
    process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:3001",
  );
  const [draft, setDraft] = useState(server);
  const [token, setToken] = useState<string | null>(null);
  const [theme, setTheme] = useState<CosmeticSku | null>(null);
  const [storageError, setStorageError] = useState(false);
  const { width } = useWindowDimensions();
  const boardWidth = Math.min(width - 32, 540);
  const t = messages[locale];
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
  return (
    <ScrollView
      contentContainerStyle={[
        styles.screen,
        { direction: locale === "fa" ? "rtl" : "ltr" },
        theme && {
          backgroundColor: theme === "aurora" ? "#e2eee9" : "#f5e6d9",
        },
      ]}
    >
      <View style={{ width: boardWidth, gap: 16 }}>
        <View style={styles.row}>
          <Text style={styles.title}>{t.brand} ✦</Text>
          <Button
            title={t.language}
            onPress={() => setLocale(locale === "fa" ? "en" : "fa")}
          />
        </View>
        <Text style={styles.fine}>{t.tagline}</Text>
        <View style={styles.row}>
          {[
            ["practice", t.practice],
            ["online", t.online],
            ["account", t.signIn],
          ].map(([key, title]) => (
            <Button key={key} title={title!} onPress={() => setMode(key!)} />
          ))}
        </View>
        {mode === "practice" ? (
          <Practice t={t} width={boardWidth} />
        ) : (
          <>
            <Input label={t.server} value={draft} onChange={setDraft} />
            <Button
              title={t.reconnect}
              onPress={() => {
                if (/^https?:\/\//.test(draft))
                  setServer(draft.replace(/\/$/, ""));
              }}
            />
            {mode === "online" ? (
              <Online
                t={t}
                width={boardWidth}
                server={server}
                token={token}
                inviteCode={inviteCode}
              />
            ) : (
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
            )}
          </>
        )}
        {storageError && <Text>{t.secureStorage}</Text>}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    alignItems: "center",
    padding: 16,
    paddingTop: 52,
    paddingBottom: 48,
    backgroundColor: "#f1f3ed",
  },
  title: { fontSize: 28, fontWeight: "bold", color: "#203e38" },
  heading: { fontSize: 18, fontWeight: "bold", color: "#203e38" },
  row: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
  },
  button: {
    backgroundColor: "#235e4f",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  buttonText: { color: "white", fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#c4d1c0",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "white",
    color: "#203e38",
  },
  label: { fontSize: 12, color: "#647565", marginBottom: 6 },
  dice: { fontSize: 38, textAlign: "center", color: "#203e38" },
  fine: { fontSize: 11, lineHeight: 20, color: "#74836d" },
  error: { color: "#a6463c" },
});
