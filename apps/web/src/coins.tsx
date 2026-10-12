import { createContext, useCallback, useEffect, useRef, useState } from "react";
import {
  WalletClient,
  WalletRequestError,
  type WalletView,
} from "@mench/game-client";
import type { BoardThemeId, PawnSetId } from "@mench/board-geometry";
import { EDGE, SERVER } from "./backend";

/** The designs the board draws with; classic until the wallet says otherwise. */
export const Appearance = createContext<{
  board: BoardThemeId;
  pawns: PawnSetId;
}>({ board: "classic", pawns: "classic" });

const CREDENTIALS = "mench-wallet";
const CACHE = "mench-wallet-view";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage may be blocked; the wallet still works for this visit. */
  }
}

/** Coins and designs (edge builds only; the Node API has its own economy). */
export function useWallet() {
  const client = useRef<WalletClient | null>(null);
  const [wallet, setWallet] = useState<WalletView | null>(() =>
    read<WalletView>(CACHE),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const adopt = useCallback((next: WalletView) => {
    setWallet(next);
    write(CACHE, next);
  }, []);
  useEffect(() => {
    if (!EDGE) return;
    const c = new WalletClient(
      SERVER ?? location.origin,
      {
        load: async () => read(CREDENTIALS),
        save: async (credentials) => write(CREDENTIALS, credentials),
      },
      {
        uuid: () => crypto.randomUUID(),
        bytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
      },
    );
    client.current = c;
    c.open()
      .then(adopt)
      .catch(() => setError("OFFLINE"));
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
