/** Coins and shop designs, stored by the edge server (/api/wallet). */
export interface WalletItem {
  sku: string;
  kind: "board" | "pawns";
  id: string;
  price: number;
  name: { fa: string; en: string };
}
export interface WalletView {
  coins: number;
  owned: string[];
  equipped: { board: string; pawns: string };
  dailyAvailable: boolean;
  daily: number;
  catalog: WalletItem[];
}
export interface WalletCredentials {
  id: string;
  token: string;
}
export interface WalletStore {
  load(): Promise<WalletCredentials | null>;
  save(credentials: WalletCredentials): Promise<void>;
}
export class WalletRequestError extends Error {
  constructor(
    readonly code: string,
    readonly wallet?: WalletView,
  ) {
    super(code);
  }
}

function hex64(randomBytes: (n: number) => Uint8Array): string {
  return Array.from(randomBytes(32), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Anonymous wallet: on first use the device makes a random id and secret
 * and registers them; the server only keeps the secret's hash.
 */
export class WalletClient {
  private credentials: WalletCredentials | null = null;
  constructor(
    private readonly base: string,
    private readonly store: WalletStore,
    private readonly random: {
      uuid: () => string;
      bytes: (n: number) => Uint8Array;
    },
  ) {}

  private async call(
    action: string,
    body?: unknown,
  ): Promise<{ wallet: WalletView; granted?: number }> {
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
    this.credentials ??= await this.store.load();
    if (this.credentials) {
      try {
        return (await this.call("wallet")).wallet;
      } catch (error) {
        // A wallet the server no longer knows: start a new one.
        if (
          !(error instanceof WalletRequestError) ||
          error.code !== "UNAUTHENTICATED"
        )
          throw error;
      }
    }
    this.credentials = {
      id: this.random.uuid(),
      token: hex64(this.random.bytes),
    };
    const created = await this.call("create");
    await this.store.save(this.credentials);
    return created.wallet;
  }

  daily() {
    return this.call("daily");
  }
  async buy(sku: string) {
    return (await this.call("buy", { sku })).wallet;
  }
  async equip(sku: string) {
    return (await this.call("equip", { sku })).wallet;
  }
}
