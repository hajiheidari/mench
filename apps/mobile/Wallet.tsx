import { useEffect, useRef, useState } from "react";
import { Text, View, Pressable } from "react-native";
import * as Crypto from "expo-crypto";
import { readEconomy, buyCosmetic, equipCosmetic } from "@mench/game-client";
import type { CosmeticSku, EconomySnapshot } from "@mench/game-protocol";
import type { Messages } from "@mench/localization";
export function Wallet({
  t,
  server,
  token,
  onTheme,
}: {
  t: Messages;
  server: string;
  token: string | null;
  onTheme: (sku: CosmeticSku | null) => void;
}) {
  const [data, setData] = useState<EconomySnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const requests = useRef(new Map<CosmeticSku, string>());
  useEffect(() => {
    void readEconomy({ url: server, token })
      .then(setData)
      .catch(() => setNotice(t.error));
  }, [server, token, t.error]);
  async function action(sku: CosmeticSku | null, buy = false) {
    setBusy(true);
    setNotice("");
    const options = { url: server, token };
    try {
      if (buy && sku) {
        const id = requests.current.get(sku) ?? Crypto.randomUUID();
        requests.current.set(sku, id);
        await buyCosmetic(options, sku, id);
      } else await equipCosmetic(options, sku);
      const snapshot = await readEconomy(options);
      setData(snapshot);
      onTheme(snapshot.active);
      setNotice(t.done);
    } catch (e) {
      setNotice(
        t.errors[e instanceof Error ? e.message : "REQUEST_FAILED"] ?? t.error,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <Text style={{ fontSize: 20, marginTop: 16 }}>{t.wallet}</Text>
      {data && (
        <>
          <Text>
            {t.coins}: {data.balance}
          </Text>
          <Text>{t.coinHint}</Text>
          {data.catalog.map((item) => (
            <View key={item.sku}>
              <Text>
                {t[item.sku]} · {item.price} {t.coins}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${data.owned.includes(item.sku) ? t.equip : t.buy} · ${t[item.sku]}`}
                disabled={busy || data.active === item.sku}
                style={{ padding: 12, minHeight: 44 }}
                onPress={() =>
                  void action(item.sku, !data.owned.includes(item.sku))
                }
              >
                <Text>
                  {data.owned.includes(item.sku) ? t.equip : t.buy} ·{" "}
                  {t[item.sku]}
                </Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            disabled={busy || !data.active}
            style={{ padding: 12, minHeight: 44 }}
            onPress={() => void action(null)}
          >
            <Text>{t.plain}</Text>
          </Pressable>
          <Text>{t.ledger}</Text>
          {data.ledger.map((entry, i) => (
            <Text key={i}>
              {t[entry.kind]} · {entry.delta}
            </Text>
          ))}
        </>
      )}
      {!!notice && <Text>{notice}</Text>}
    </View>
  );
}
