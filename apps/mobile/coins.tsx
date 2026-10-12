import { useCallback, useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import {
  WalletClient,
  WalletRequestError,
  type WalletCredentials,
  type WalletView,
} from "@mench/game-client";
import { DEFAULT_SERVER, EDGE } from "./OnlineGame";
import { getStored, setStored } from "./storage";

export { Appearance } from "./appearance";

const CREDENTIALS = "mench-wallet";
const CACHE = "mench-wallet-view";

async function read<T>(key: string): Promise<T | null> {
  try {
    const raw = await getStored(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  void setStored(key, JSON.stringify(value)).catch(() => undefined);
}

/** Coins and designs, kept by the edge server (store builds only). */
export function useWallet() {
  const client = useRef<WalletClient | null>(null);
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const adopt = useCallback((next: WalletView) => {
    setWallet(next);
    write(CACHE, next);
  }, []);
  useEffect(() => {
    if (!EDGE) return;
    let live = true;
    // Show the last known designs at once, even offline.
    void read<WalletView>(CACHE).then((cached) => {
      if (live && cached) setWallet((w) => w ?? cached);
    });
    const c = new WalletClient(
      DEFAULT_SERVER,
      {
        load: () => read<WalletCredentials>(CREDENTIALS),
        save: async (credentials) =>
          setStored(CREDENTIALS, JSON.stringify(credentials)),
      },
      {
        uuid: () => Crypto.randomUUID(),
        bytes: (n) => Crypto.getRandomBytes(n),
      },
    );
    client.current = c;
    c.open()
      .then((w) => live && adopt(w))
      .catch(() => live && setError("OFFLINE"));
    return () => {
      live = false;
    };
  }, [adopt]);
  const run = useCallback(
    async (action: (c: WalletClient) => Promise<WalletView>) => {
      if (!client.current) return false;
      setBusy(true);
      setError("");
      try {
        adopt(await action(client.current));
        return true;
      } catch (e) {
        if (e instanceof WalletRequestError) {
          if (e.wallet) adopt(e.wallet);
          setError(e.code);
        } else setError("OFFLINE");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [adopt],
  );
  return {
    wallet,
    error,
    busy,
    enabled: EDGE,
    claim: () => run(async (c) => (await c.daily()).wallet),
    buy: (sku: string) => run((c) => c.buy(sku)),
    equip: (sku: string) => run((c) => c.equip(sku)),
  };
}
export type Wallet = ReturnType<typeof useWallet>;
