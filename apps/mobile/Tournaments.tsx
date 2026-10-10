import { Text } from "./Theme";
import { useEffect, useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import {
  listTournaments,
  readTournament,
  createTournament,
  sendTournament,
} from "@mench/game-client";
import type {
  PublicTournament,
  TournamentListing,
  TournamentIntent,
} from "@mench/game-protocol";
import type { Messages } from "@mench/localization";
function Action({
  title,
  run,
  disabled = false,
}: {
  title: string;
  run: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={run}
      style={[styles.button, disabled && { opacity: 0.5 }]}
    >
      <Text>{title}</Text>
    </Pressable>
  );
}
export function Tournaments({
  t,
  userId,
  server,
  token,
  onInvite,
}: {
  t: Messages;
  userId: string;
  server: string;
  token: string | null;
  onInvite: (code: string) => void;
}) {
  const [list, setList] = useState<TournamentListing>({ tournaments: [] });
  const [current, setCurrent] = useState<PublicTournament | null>(null);
  const [id, setId] = useState("");
  const [capacity, setCapacity] = useState<4 | 8 | 16 | 32>(4);
  const [code, setCode] = useState("");
  const [matchId, setMatchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const options = { url: server, token };
  const error = (e: unknown) =>
    setNotice(
      t.errors[e instanceof Error ? e.message : "REQUEST_FAILED"] ?? t.error,
    );
  useEffect(() => {
    void listTournaments({ url: server, token })
      .then(setList)
      .catch(() => setNotice(t.error));
  }, [server, token, t.error]);
  useEffect(() => {
    if (!current || current.phase !== "running") return;
    const timer = setInterval(() => {
      void readTournament({ url: server, token }, current.id)
        .then(setCurrent)
        .catch(() => setNotice(t.error));
    }, 5000);
    return () => clearInterval(timer);
  }, [current?.id, current?.phase, server, token, t.error]);
  async function action(intent?: TournamentIntent, create = false) {
    setBusy(true);
    setNotice("");
    try {
      const result = create
        ? await createTournament(options, capacity)
        : intent && current
          ? await sendTournament(options, current.id, intent)
          : await readTournament(options, id);
      setCurrent(result);
      setId(result.id);
      setList(await listTournaments(options));
    } catch (e) {
      error(e);
    } finally {
      setBusy(false);
    }
  }
  const name = (player: string | null) =>
    current?.profiles.find((p) => p.id === player)?.name ?? t.waiting;
  const ready =
    current?.rounds
      .flat()
      .filter(
        (m) =>
          m.players.includes(userId) &&
          m.players.every(Boolean) &&
          !m.winner &&
          !m.gameId,
      ) ?? [];
  return (
    <View>
      <Text style={styles.heading}>{t.tournament}</Text>
      <View style={styles.row}>
        {([4, 8, 16, 32] as const).map((n) => (
          <Action
            key={n}
            title={`${capacity === n ? "✓ " : ""}${n}`}
            run={() => setCapacity(n)}
            disabled={busy}
          />
        ))}
      </View>
      <Action
        title={t.createTournament}
        run={() => void action(undefined, true)}
        disabled={busy}
      />
      <Text>{t.tournamentId}</Text>
      <TextInput
        accessibilityLabel={t.tournamentId}
        value={id}
        onChangeText={setId}
        maxLength={36}
        autoCapitalize="none"
        style={styles.input}
      />
      <Action
        title={`${t.view} · ${t.tournament}`}
        run={() => void action()}
        disabled={busy || !id}
      />
      {list.tournaments.map((item) => (
        <Action
          key={item.id}
          title={`${item.capacity} · ${t[item.phase]} · ${item.id.slice(0, 8)}`}
          disabled={busy}
          run={() => {
            setId(item.id);
            void readTournament(options, item.id).then(setCurrent).catch(error);
          }}
        />
      ))}
      {current && (
        <>
          <Text>
            {current.players.length}/{current.capacity} · {t[current.phase]}
          </Text>
          <Text selectable>{current.id}</Text>
          <Action
            title={`${t.refresh} · ${t.tournament}`}
            run={() => void action()}
            disabled={busy}
          />
          {current.phase === "lobby" && (
            <>
              {!current.players.includes(userId) && (
                <Action
                  title={t.join}
                  run={() => void action({ type: "join" })}
                  disabled={busy}
                />
              )}{" "}
              {current.players.includes(userId) && current.owner !== userId && (
                <Action
                  title={t.leave}
                  run={() => void action({ type: "leave" })}
                  disabled={busy}
                />
              )}{" "}
              {current.owner === userId && (
                <>
                  <Action
                    title={t.start}
                    run={() => void action({ type: "start" })}
                    disabled={
                      busy || current.players.length !== current.capacity
                    }
                  />
                  <Action
                    title={t.cancel}
                    run={() => void action({ type: "cancel" })}
                    disabled={busy}
                  />
                </>
              )}
            </>
          )}
          <Text>{current.players.map(name).join(" · ")}</Text>
          {current.rounds.map((matches, r) => (
            <View key={r}>
              <Text style={styles.heading}>
                {t.round} {r + 1}
              </Text>
              {matches.map((m) => (
                <View key={m.id}>
                  <Text>
                    {name(m.players[0])} × {name(m.players[1])}
                    {m.winner ? ` · ${t.winner}: ${name(m.winner)}` : ""}
                  </Text>
                  {m.roomCode && !m.winner && (
                    <Action
                      title={`${t.join} · ${m.roomCode}`}
                      run={() => onInvite(m.roomCode!)}
                      disabled={busy}
                    />
                  )}
                </View>
              ))}
            </View>
          ))}
          {ready.length > 0 && (
            <>
              <Text>{t.tournamentHint}</Text>
              {ready.map((m) => (
                <Action
                  key={m.id}
                  title={`${matchId === m.id ? "✓ " : ""}${name(m.players[0])} × ${name(m.players[1])}`}
                  run={() => setMatchId(m.id)}
                  disabled={busy}
                />
              ))}
              <Text>{t.code}</Text>
              <TextInput
                accessibilityLabel={`${t.tournament} · ${t.code}`}
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                maxLength={10}
                style={styles.input}
              />
              <Action
                title={t.linkMatch}
                run={() => void action({ type: "link", matchId, code })}
                disabled={busy || !matchId || code.length !== 10}
              />
            </>
          )}
          {current.winner && (
            <Text style={styles.heading}>
              {t.winner}: {name(current.winner)}
            </Text>
          )}
        </>
      )}
      {!!notice && <Text>{notice}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  heading: { fontSize: 20, marginTop: 16 },
  button: {
    padding: 12,
    minHeight: 44,
    backgroundColor: "#63418c",
    marginVertical: 4,
    borderRadius: 8,
  },
  input: {
    color: "#fff4df",
    backgroundColor: "#2d1c48",
    borderWidth: 1,
    borderColor: "#a5b8b0",
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
