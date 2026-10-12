import { createContext, useCallback, useEffect, useRef, useState } from "react";
import {
  WalletClient,
  WalletRequestError,
  type WalletView,
} from "@mench/game-client";
import type {
  BoardThemeId,
  DiceSkinId,
  PawnSetId,
} from "@mench/board-geometry";
import { EDGE, SERVER } from "./backend";

/** The designs the board draws with; classic until the wallet says otherwise. */
export const Appearance = createContext<{
  board: BoardThemeId;
  pawns: PawnSetId;
  dice: DiceSkinId;
}>({ board: "classic", pawns: "classic", dice: "classic" });

/** The recovery code (the wallet's only secret) on this browser. */
const CODE = "mench-wallet-code";
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
        load: async () => read<string>(CODE),
        save: async (code) => write(CODE, code),
      },
      {
        bytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
        sha256Hex: async (text) =>
          [
            ...new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(text),
              ),
            ),
          ]
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(""),
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
    code: client.current?.code ?? null,
    claim: () => run(async (c) => (await c.daily()).wallet),
    /** Credits a rewarded ad that the ad network reported as watched. */
    adReward: () => run(async (c) => (await c.ad()).wallet),
    recover: (code: string) => run((c) => c.recover(code)),
    buy: (sku: string) => run((c) => c.buy(sku)),
    equip: (sku: string) => run((c) => c.equip(sku)),
  };
}
export type Wallet = ReturnType<typeof useWallet>;
