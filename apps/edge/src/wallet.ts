import {
  AD_COINS,
  AD_DAILY_LIMIT,
  CATALOG,
  DAILY_COINS,
  FREE_SKUS,
  type CatalogItem,
} from "@mench/board-geometry";

/**
 * A player's coins and designs. Anonymous: the wallet id and a random secret
 * live on the device; the server keeps only the secret's SHA-256.
 * Coins buy looks only (boards, pawns); they never touch dice or rules.
 */
export interface WalletState {
  tokenHash: string;
  coins: number;
  owned: string[];
  equipped: { board: string; pawns: string; dice: string };
  /** Asia/Tehran calendar day of the last daily reward (YYYY-MM-DD). */
  lastDaily: string | null;
  /** Rewarded ads watched on adDay, and when the last one paid out. */
  adDay?: string;
  adCount?: number;
  adAt?: number;
  created: number;
}

export interface WalletView {
  coins: number;
  owned: string[];
  equipped: { board: string; pawns: string; dice: string };
  dailyAvailable: boolean;
  daily: number;
  adCoins: number;
  adsLeft: number;
  catalog: readonly CatalogItem[];
}

export class WalletError extends Error {}

/** The day boundary players expect: midnight in Iran. */
export function tehranDay(now: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function newWallet(tokenHash: string, now: number): WalletState {
  return {
    tokenHash,
    coins: 0,
    owned: [...FREE_SKUS],
    equipped: { board: "classic", pawns: "classic", dice: "classic" },
    lastDaily: null,
    created: now,
  };
}

/** Wallets made before a new kind of design existed get its free item. */
export function upgrade(state: WalletState): WalletState {
  for (const sku of FREE_SKUS)
    if (!state.owned.includes(sku)) state.owned.push(sku);
  const worn = state.equipped as Partial<WalletState["equipped"]>;
  state.equipped = {
    board: worn.board ?? "classic",
    pawns: worn.pawns ?? "classic",
    dice: worn.dice ?? "classic",
  };
  return state;
}

function adsLeft(state: WalletState, now: number): number {
  return state.adDay === tehranDay(now)
    ? Math.max(0, AD_DAILY_LIMIT - (state.adCount ?? 0))
    : AD_DAILY_LIMIT;
}

export function view(state: WalletState, now: number): WalletView {
  return {
    coins: state.coins,
    owned: state.owned,
    equipped: state.equipped,
    dailyAvailable: state.lastDaily !== tehranDay(now),
    daily: DAILY_COINS,
    adCoins: AD_COINS,
    adsLeft: adsLeft(state, now),
    catalog: CATALOG,
  };
}

/**
 * Coins for a rewarded ad watched in the shop. The ad network cannot be
 * verified from here, so it is capped: AD_DAILY_LIMIT a day, 30 s apart.
 * Coins only buy looks, which keeps the incentive to cheat small.
 */
export function rewardAd(state: WalletState, now: number): number {
  if (adsLeft(state, now) === 0) throw new WalletError("AD_LIMIT");
  if (state.adAt && now - state.adAt < 30_000)
    throw new WalletError("AD_TOO_SOON");
  const today = tehranDay(now);
  state.adCount = state.adDay === today ? (state.adCount ?? 0) + 1 : 1;
  state.adDay = today;
  state.adAt = now;
  state.coins += AD_COINS;
  return AD_COINS;
}

/** Grants the daily coins once per Tehran day; returns the coins granted. */
export function claimDaily(state: WalletState, now: number): number {
  const today = tehranDay(now);
  if (state.lastDaily === today) return 0;
  state.lastDaily = today;
  state.coins += DAILY_COINS;
  return DAILY_COINS;
}

function item(sku: unknown): CatalogItem {
  const found = CATALOG.find((i) => i.sku === sku);
  if (!found) throw new WalletError("UNKNOWN_ITEM");
  return found;
}

export function buy(state: WalletState, sku: unknown) {
  const it = item(sku);
  if (state.owned.includes(it.sku)) throw new WalletError("ALREADY_OWNED");
  if (state.coins < it.price) throw new WalletError("INSUFFICIENT_COINS");
  state.coins -= it.price;
  state.owned.push(it.sku);
  // A new design is what the player wants to see right away.
  state.equipped = { ...state.equipped, [it.kind]: it.id };
}

export function equip(state: WalletState, sku: unknown) {
  const it = item(sku);
  if (!state.owned.includes(it.sku)) throw new WalletError("NOT_OWNED");
  state.equipped = { ...state.equipped, [it.kind]: it.id };
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time comparison of two hex digests. */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
