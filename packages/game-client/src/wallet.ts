/** Coins and shop designs, stored by the edge server (/api/wallet). */
export interface WalletItem {
  sku: string;
  kind: "board" | "pawns" | "dice";
  id: string;
  price: number;
  name: { fa: string; en: string };
}
export interface WalletView {
  coins: number;
  owned: string[];
  equipped: { board: string; pawns: string; dice: string };
  dailyAvailable: boolean;
  daily: number;
  adCoins: number;
  adsLeft: number;
  catalog: WalletItem[];
}
/** Where the recovery code is kept on the device (and its cloud backups). */
export interface WalletStore {
  load(): Promise<string | null>;
  save(code: string): Promise<void>;
}
export class WalletRequestError extends Error {
  constructor(
    readonly code: string,
    readonly wallet?: WalletView,
  ) {
    super(code);
  }
}

// Crockford base32: no I, L, O or U, so a code read aloud or retyped survives.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 16;

/** "k7qm 3xzd-..." -> "K7QM3XZD..."; null when it cannot be a code. */
export function normalizeRecoveryCode(input: string): string | null {
  const code = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((c) => ALPHABET.includes(c)) ? code : null;
}

/** K7QM-3XZD-9P2A-HT4R */
export function formatRecoveryCode(code: string): string {
  return code.match(/.{1,4}/g)!.join("-");
}

/**
 * Anonymous wallet opened by an 80-bit recovery code. The wallet id and the
 * secret sent to the server are both derived from the code, so the code alone
 * restores the wallet on any phone or browser; the server stores only a hash.
 */
export class WalletClient {
  private credentials: { id: string; token: string } | null = null;
  private recoveryCode: string | null = null;
  constructor(
    private readonly base: string,
    private readonly store: WalletStore,
    private readonly crypto: {
      bytes: (n: number) => Uint8Array;
      sha256Hex: (text: string) => Promise<string>;
    },
  ) {}

  /** The current recovery code, formatted for display. */
  get code(): string | null {
    return this.recoveryCode && formatRecoveryCode(this.recoveryCode);
  }

  private async use(code: string) {
    const idHex = await this.crypto.sha256Hex(`mench-wallet-id:${code}`);
    const token = await this.crypto.sha256Hex(`mench-wallet-token:${code}`);
    const id = `${idHex.slice(0, 8)}-${idHex.slice(8, 12)}-${idHex.slice(12, 16)}-${idHex.slice(16, 20)}-${idHex.slice(20, 32)}`;
    this.credentials = { id, token };
    this.recoveryCode = code;
  }

  private async call(
    action: string,
    body?: unknown,
  ): Promise<{ wallet: WalletView; granted: number }> {
    const creds = this.credentials!;
    const response = await fetch(
      `${this.base.replace(/\/$/, "")}/api/wallet/${action}`,
      {
        method: action === "wallet" ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wallet-Id": creds.id,
          "X-Wallet-Token": creds.token,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    const data = (await response.json().catch(() => ({}))) as {
      wallet?: WalletView;
      granted?: number;
      error?: string;
    };
    if (!response.ok || !data.wallet)
      throw new WalletRequestError(data.error ?? "REQUEST_FAILED", data.wallet);
    return { wallet: data.wallet, granted: data.granted ?? 0 };
  }

  async open(): Promise<WalletView> {
    const saved = normalizeRecoveryCode((await this.store.load()) ?? "");
    if (saved) {
      await this.use(saved);
      try {
        return (await this.call("wallet")).wallet;
      } catch (error) {
        if (
          !(error instanceof WalletRequestError) ||
          error.code !== "UNAUTHENTICATED"
        )
          throw error;
        // The server does not know this code: start it afresh, same code.
        return (await this.call("create")).wallet;
      }
    }
    const code = Array.from(
      this.crypto.bytes(CODE_LENGTH),
      (b) => ALPHABET[b % 32],
    ).join("");
    await this.use(code);
    const created = await this.call("create");
    await this.store.save(code);
    return created.wallet;
  }

  /** Switches this device to the wallet of another recovery code. */
  async recover(input: string): Promise<WalletView> {
    const code = normalizeRecoveryCode(input);
    if (!code) throw new WalletRequestError("BAD_CODE");
    const previous = { creds: this.credentials, code: this.recoveryCode };
    await this.use(code);
    try {
      const { wallet } = await this.call("wallet");
      await this.store.save(code);
      return wallet;
    } catch (error) {
      this.credentials = previous.creds;
      this.recoveryCode = previous.code;
      throw error instanceof WalletRequestError &&
        error.code === "UNAUTHENTICATED"
        ? new WalletRequestError("CODE_NOT_FOUND")
        : error;
    }
  }

  daily() {
    return this.call("daily");
  }
  ad() {
    return this.call("ad");
  }
  async buy(sku: string) {
    return (await this.call("buy", { sku })).wallet;
  }
  async equip(sku: string) {
    return (await this.call("equip", { sku })).wallet;
  }
}
