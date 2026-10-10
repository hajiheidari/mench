import { Text } from "./Theme";
import { useEffect, useRef, useState } from "react";
import { View, TextInput, Pressable, Alert } from "react-native";
import * as Crypto from "expo-crypto";
import { readAdmin, sendAdmin } from "@mench/game-client";
import type {
  AdminIntent,
  AdminSummary,
  ModerationReason,
} from "@mench/game-protocol";
import type { Messages } from "@mench/localization";
type ActionInput =
  | Omit<Extract<AdminIntent, { type: "suspend" }>, "requestId">
  | Omit<Extract<AdminIntent, { type: "unsuspend" }>, "requestId">
  | Omit<Extract<AdminIntent, { type: "report" }>, "requestId">
  | Omit<Extract<AdminIntent, { type: "cancelTournament" }>, "requestId">;
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
      onPress={run}
      disabled={disabled}
      style={{
        padding: 12,
        minHeight: 44,
        backgroundColor: "#63418c",
        borderRadius: 8,
        marginVertical: 4,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text>{title}</Text>
    </Pressable>
  );
}
export function Admin({
  t,
  server,
  token,
}: {
  t: Messages;
  server: string;
  token: string | null;
}) {
  const [data, setData] = useState<AdminSummary | null>(null);
  const [target, setTarget] = useState("");
  const [days, setDays] = useState("1");
  const [reason, setReason] = useState<ModerationReason>("abuse");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const requests = useRef(new Map<string, string>());
  const options = { url: server, token };
  useEffect(() => {
    void readAdmin({ url: server, token })
      .then(setData)
      .catch(() => setNotice(t.error));
  }, [server, token, t.error]);
  async function action(input: ActionInput) {
    setBusy(true);
    setNotice("");
    const key = JSON.stringify(input);
    const id = requests.current.get(key) ?? Crypto.randomUUID();
    requests.current.set(key, id);
    try {
      await sendAdmin(options, { ...input, requestId: id });
      setData(await readAdmin(options));
      requests.current.delete(key);
      setNotice(t.done);
    } catch (e) {
      setNotice(
        t.errors[e instanceof Error ? e.message : "REQUEST_FAILED"] ?? t.error,
      );
    } finally {
      setBusy(false);
    }
  }
  if (!data) return null;
  return (
    <View>
      <Text style={{ fontSize: 20, marginTop: 16 }}>{t.admin}</Text>
      <Text>
        {data.health.healthy ? t.healthy : t.error} · {t.rooms}:{" "}
        {data.health.rooms} · {t.activeGames}: {data.health.activeGames}
      </Text>
      <Action
        title={`${t.refresh} · ${t.admin}`}
        run={() =>
          void readAdmin(options)
            .then(setData)
            .catch(() => setNotice(t.error))
        }
        disabled={busy}
      />
      <Text>{t.recentUsers}</Text>
      {data.users.map((u) => (
        <Action
          key={u.id}
          title={`${target === u.id ? "✓ " : ""}${u.name}${u.banned_until && Date.parse(u.banned_until) > Date.now() ? " · " + t.suspend : ""}`}
          run={() => setTarget(u.id)}
          disabled={busy}
        />
      ))}
      <Text>{t.days}</Text>
      <TextInput
        accessibilityLabel={t.days}
        value={days}
        onChangeText={setDays}
        keyboardType="number-pad"
        maxLength={2}
        style={{ padding: 12, borderWidth: 1, borderRadius: 8 }}
      />
      {(["abuse", "cheating", "spam"] as const).map((r) => (
        <Action
          key={r}
          title={`${reason === r ? "✓ " : ""}${t[r]}`}
          run={() => setReason(r)}
          disabled={busy}
        />
      ))}
      <Action
        title={t.suspend}
        disabled={busy || !target}
        run={() =>
          Alert.alert(t.suspend, t.adminConfirm, [
            { text: t.cancel, style: "cancel" },
            {
              text: t.suspend,
              style: "destructive",
              onPress: () =>
                void action({
                  type: "suspend",
                  userId: target,
                  days: Number(days),
                  reason,
                }),
            },
          ])
        }
      />
      <Action
        title={t.unsuspend}
        disabled={busy || !target}
        run={() => void action({ type: "unsuspend", userId: target, reason })}
      />
      <Text>{t.reports}</Text>
      {data.reports.map((report) => (
        <View key={report.id}>
          <Text>
            {t[report.reason]} · {t[report.status]}
          </Text>
          {report.status === "pending" && (
            <>
              <Action
                title={t.dismissed}
                disabled={busy}
                run={() =>
                  void action({
                    type: "report",
                    reportId: report.id,
                    status: "dismissed",
                  })
                }
              />
              <Action
                title={t.actioned}
                disabled={busy}
                run={() =>
                  void action({
                    type: "report",
                    reportId: report.id,
                    status: "actioned",
                  })
                }
              />
            </>
          )}
        </View>
      ))}
      <Text>{t.tournament}</Text>
      {data.tournaments.map((item) => (
        <View key={item.id}>
          <Text selectable>
            {item.capacity} · {t[item.phase]} · {item.id}
          </Text>
          <Action
            title={t.cancelTournament}
            disabled={busy}
            run={() =>
              void action({
                type: "cancelTournament",
                tournamentId: item.id,
                reason,
              })
            }
          />
        </View>
      ))}
      <Text>{t.ledger}</Text>
      {data.ledger.map((entry, i) => (
        <Text key={i}>
          {t[entry.kind]} · {entry.delta}
        </Text>
      ))}
      <Text>{t.audit}</Text>
      {data.audit.map((entry, i) => (
        <Text key={i}>
          {entry.action === "report" ? t.report : t[entry.action]}
        </Text>
      ))}{" "}
      {!!notice && <Text>{notice}</Text>}
    </View>
  );
}
