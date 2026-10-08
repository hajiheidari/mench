import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { readHistory, readTranscript } from "@mench/game-client";
import {
  verifyTranscriptConsistency,
  type GameHistory,
} from "@mench/game-protocol";
import type { Messages } from "@mench/localization";
export function History({
  t,
  server,
  token,
}: {
  t: Messages;
  server: string;
  token: string | null;
}) {
  const [data, setData] = useState<GameHistory | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void readHistory({ url: server, token })
      .then(setData)
      .catch(() => setStatus(t.error));
  }, [server, token, t.error]);
  async function inspect(id: string) {
    setBusy(true);
    try {
      const value = await readTranscript(id, { url: server, token });
      setStatus(
        verifyTranscriptConsistency(value)
          ? t.replayConsistent
          : t.replayInvalid,
      );
    } catch {
      setStatus(t.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <Text style={{ fontSize: 20, marginTop: 16 }}>{t.gameHistory}</Text>
      <Text>{t.archiveHint}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() =>
          void readHistory({ url: server, token })
            .then(setData)
            .catch(() => setStatus(t.error))
        }
        style={{ padding: 12, minHeight: 44 }}
      >
        <Text>
          {t.refresh} · {t.gameHistory}
        </Text>
      </Pressable>
      {data?.games.length === 0 && <Text>{t.noGames}</Text>}
      {data?.games.map((game) => (
        <View key={game.id}>
          <Text>
            {game.players.map((p) => p.name).join(" · ")} ·{" "}
            {new Date(game.createdAt).toLocaleDateString()} ·{" "}
            {game.won ? t.wins : t.finished}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !game.replayAvailable}
            onPress={() => void inspect(game.id)}
            style={{ padding: 12, minHeight: 44 }}
          >
            <Text>{t.replayCheck}</Text>
          </Pressable>
        </View>
      ))}
      {status && <Text>{status}</Text>}
    </View>
  );
}
