import { useEffect, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { readRankings } from "@mench/game-client";
import type { Messages } from "@mench/localization";
export function Rankings({
  t,
  server,
  token,
}: {
  t: Messages;
  server: string;
  token: string | null;
}) {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof readRankings>
  > | null>(null);
  const [error, setError] = useState(false);
  const refresh = () => {
    setError(false);
    void readRankings({ url: server, token })
      .then(setData)
      .catch(() => setError(true));
  };
  useEffect(() => {
    void readRankings({ url: server, token })
      .then(setData)
      .catch(() => setError(true));
  }, [server, token]);
  return (
    <View>
      <Text style={{ fontSize: 20, marginTop: 16 }}>{t.ranking}</Text>
      <Text>{t.rankedHint}</Text>
      {data && (
        <Text>
          {t.rating}: {data.self.rating} · {t.games}: {data.self.games} ·{" "}
          {t.wins}: {data.self.wins}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={refresh}
        style={{ padding: 12, minHeight: 44 }}
      >
        <Text>
          {t.refresh} · {t.ranking}
        </Text>
      </Pressable>
      {data?.leaderboard.players.map((p, i) => (
        <Text key={p.id}>
          {i + 1}. {p.name} · {p.rating}
        </Text>
      ))}
      {error && <Text>{t.error}</Text>}
    </View>
  );
}
