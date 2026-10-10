import { Text } from "./Theme";
import { useEffect, useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { readSocial, sendSocial } from "@mench/game-client";
import type { SocialIntent, SocialSnapshot } from "@mench/game-protocol";
import type { Messages } from "@mench/localization";
function Action({
  title,
  run,
  disabled,
}: {
  title: string;
  run: () => void;
  disabled: boolean;
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
export function Social({
  t,
  server,
  token,
  onInvite,
}: {
  t: Messages;
  server: string;
  token: string | null;
  onInvite: (code: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<SocialSnapshot | null>(null);
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [reason, setReason] = useState<"abuse" | "cheating" | "spam">("abuse");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const options = { url: server, token };
  const error = (e: unknown) =>
    setNotice(
      t.errors[e instanceof Error ? e.message : "REQUEST_FAILED"] ?? t.error,
    );
  useEffect(() => {
    void readSocial({ url: server, token })
      .then(setSnapshot)
      .catch((e) =>
        setNotice(
          t.errors[e instanceof Error ? e.message : "REQUEST_FAILED"] ??
            t.error,
        ),
      );
  }, [server, token, t]);
  async function refresh() {
    try {
      setSnapshot(await readSocial(options));
    } catch (e) {
      error(e);
    }
  }
  async function action(id: string, intent: SocialIntent) {
    setBusy(true);
    try {
      await sendSocial(options, id, intent);
      setSnapshot(await readSocial(options));
      setNotice(t.done);
    } catch (e) {
      error(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <Text style={styles.heading}>{t.social}</Text>
      <Action title={t.refresh} run={() => void refresh()} disabled={busy} />
      <Text>{t.accountId}</Text>
      <TextInput
        accessibilityLabel={t.accountId}
        value={target}
        onChangeText={setTarget}
        maxLength={36}
        autoCapitalize="none"
        style={styles.input}
      />
      <Action
        title={t.addFriend}
        run={() => void action(target, { type: "request" })}
        disabled={busy || !target}
      />
      <Action
        title={t.block}
        run={() => void action(target, { type: "block" })}
        disabled={busy || !target}
      />
      <Text>{t.report}</Text>
      <View style={styles.actions}>
        {(["abuse", "cheating", "spam"] as const).map((r) => (
          <Action
            key={r}
            title={`${reason === r ? "✓ " : ""}${t[r]}`}
            run={() => setReason(r)}
            disabled={busy}
          />
        ))}
      </View>
      <Action
        title={t.report}
        run={() => void action(target, { type: "report", reason })}
        disabled={busy || !target}
      />
      <Text>{t.code}</Text>
      <TextInput
        accessibilityLabel={t.code}
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        maxLength={10}
        style={styles.input}
      />
      {snapshot?.friends.map((f) => (
        <View key={f.id}>
          <Text style={styles.heading}>{f.name}</Text>
          <Text>
            {f.accepted
              ? f.online
                ? t.connected
                : t.disconnected
              : f.incoming
                ? t.incoming
                : t.outgoing}
          </Text>
          <Text selectable>{f.id}</Text>
          {!f.accepted && f.incoming && (
            <Action
              title={t.acceptFriend}
              run={() => void action(f.id, { type: "accept" })}
              disabled={busy}
            />
          )}{" "}
          {f.accepted && (
            <Action
              title={t.inviteFriend}
              run={() => void action(f.id, { type: "invite", code })}
              disabled={busy || code.length !== 10}
            />
          )}
          <Action
            title={t.removeFriend}
            run={() => void action(f.id, { type: "remove" })}
            disabled={busy}
          />
          <Action
            title={t.block}
            run={() => void action(f.id, { type: "block" })}
            disabled={busy}
          />
        </View>
      ))}
      {snapshot?.blocks.map((p) => (
        <View key={p.id}>
          <Text>{p.name}</Text>
          <Action
            title={t.unblock}
            run={() => void action(p.id, { type: "unblock" })}
            disabled={busy}
          />
        </View>
      ))}
      <Text style={styles.heading}>{t.invites}</Text>
      {snapshot?.invites.map((i) => (
        <View key={`${i.id}:${i.code}`}>
          <Text>
            {i.name} · {i.code}
          </Text>
          <Action title={t.join} run={() => onInvite(i.code)} disabled={busy} />
        </View>
      ))}
      <Text style={styles.heading}>{t.recentOpponents}</Text>
      {snapshot?.recent.map((p) => (
        <View key={p.id}>
          <Text>{p.name}</Text>
          <Action
            title={t.accountId}
            run={() => setTarget(p.id)}
            disabled={busy}
          />
        </View>
      ))}
      {!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  heading: { fontSize: 20, marginTop: 16 },
  input: {
    color: "#fff4df",
    backgroundColor: "#2d1c48",
    borderWidth: 1,
    borderColor: "#a5b8b0",
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  button: {
    backgroundColor: "#63418c",
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    minHeight: 44,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
