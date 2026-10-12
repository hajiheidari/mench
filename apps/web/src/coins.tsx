import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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
import type { Messages } from "./messages";

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
    /** Coins for a won game; resolves "OK" or the server's reason. */
    win: async (claim: WinClaim): Promise<string> => {
      if (!client.current) return "OFFLINE";
      try {
        adopt((await client.current.win(claim)).wallet);
        return "OK";
      } catch (e) {
        if (!(e instanceof WalletRequestError)) return "OFFLINE";
        if (e.wallet) adopt(e.wallet);
        return e.code;
      }
    },
  };
}
export type Wallet = ReturnType<typeof useWallet>;
export type WinClaim =
  { kind: "bot" } | { kind: "online"; room: string; token: string };

/** The wallet, for screens deep in the tree (game results). */
export const WalletContext = createContext<Wallet | null>(null);

/** A fresh id for one game, so its win is claimed once. */
export const newGameId = () => Math.random().toString(36).slice(2);

const claimed = new Set<string>();
/**
 * Asks once for the coins of a won game (key: one id per game) and returns
 * the line for the result popup.
 */
export function useWinCoins(
  t: Messages,
  key: string | null,
  claim: WinClaim | null,
): string {
  const wallet = useContext(WalletContext);
  const [text, setText] = useState<{ key: string; line: string } | null>(null);
  const kind = claim?.kind;
  const room = claim?.kind === "online" ? claim.room : "";
  const token = claim?.kind === "online" ? claim.token : "";
  useEffect(() => {
    if (!key || !kind || !wallet?.enabled || claimed.has(key)) return;
    claimed.add(key);
    const coins =
      kind === "online" ? wallet.wallet?.winCoins : wallet.wallet?.botWinCoins;
    void wallet
      .win(kind === "online" ? { kind, room, token } : { kind })
      .then((result) =>
        setText({
          key,
          line:
            result === "OK"
              ? t.winReward.replace("{n}", String(coins ?? ""))
              : result === "WIN_LIMIT"
                ? t.winLimit
                : "",
        }),
      );
  }, [key, kind, room, token, wallet, t]);
  return text && text.key === key ? text.line : "";
}
