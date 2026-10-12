import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Messages } from "@mench/localization";
import * as Crypto from "expo-crypto";
import {
  WalletClient,
  WalletRequestError,
  type WalletView,
} from "@mench/game-client";
import { DEFAULT_SERVER, EDGE } from "./OnlineGame";
import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import { getStored, setStored } from "./storage";
import { CloudBackup } from "./modules/cloud-backup";

export { Appearance } from "./appearance";

/** The recovery code (the wallet's only secret). */
const CODE = "mench-wallet-code";
// Android Auto Backup copies this file to the player's Google account
// (plugins/withWalletBackup); iOS keeps the code in iCloud key-value storage.
const BACKUP_FILE = "wallet-backup.txt";

function backupFile(): File | null {
  if (Platform.OS !== "android") return null;
  try {
    return new File(Paths.document, BACKUP_FILE);
  } catch {
    return null;
  }
}

/** Device keychain first, then the cloud copies (after a reinstall). */
async function loadCode(): Promise<string | null> {
  const local = await read<string>(CODE).catch(() => null);
  if (local) return local;
  try {
    const cloud = await CloudBackup?.get(CODE);
    if (cloud) return cloud;
  } catch {
    /* iCloud unavailable (signed out); fall through. */
  }
  try {
    const file = backupFile();
    if (file?.exists) return file.textSync().trim() || null;
  } catch {
    /* No Google backup restored. */
  }
  return null;
}

async function saveCode(code: string) {
  await setStored(CODE, JSON.stringify(code)).catch(() => undefined);
  await CloudBackup?.set(CODE, code).catch(() => undefined);
  try {
    backupFile()?.write(code);
  } catch {
    /* Backups are a convenience; the recovery code still works. */
  }
}
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
      { load: loadCode, save: saveCode },
      {
        bytes: (n) => Crypto.getRandomBytes(n),
        sha256Hex: (text) =>
          Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
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
