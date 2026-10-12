/**
 * Cosmetic board and pawn designs sold for coins. Every design keeps the four
 * classic player colours (red, green, yellow, blue) so seats stay readable;
 * only the material changes. Dice and rules are never affected.
 */
export type BoardThemeId =
  "classic" | "firoozeh" | "khatam" | "kashi" | "wood" | "night";
export type PawnSetId =
  "classic" | "copper" | "firoozeh" | "crystal" | "gold" | "wood";

export interface CatalogItem {
  sku: string;
  kind: "board" | "pawns";
  id: string;
  price: number;
  name: { fa: string; en: string };
}

const board = (
  id: BoardThemeId,
  price: number,
  fa: string,
  en: string,
): CatalogItem => ({
  sku: `board:${id}`,
  kind: "board",
  id,
  price,
  name: { fa, en },
});
const pawns = (
  id: PawnSetId,
  price: number,
  fa: string,
  en: string,
): CatalogItem => ({
  sku: `pawns:${id}`,
  kind: "pawns",
  id,
  price,
  name: { fa, en },
});

/** Prices are in coins; the daily reward is DAILY_COINS. */
export const CATALOG: readonly CatalogItem[] = [
  board("classic", 0, "کلاسیک", "Classic"),
  board("wood", 250, "چوبی", "Wooden"),
  board("night", 350, "شب کویر", "Desert night"),
  board("firoozeh", 500, "فیروزه‌کوبی", "Turquoise inlay"),
  board("kashi", 600, "کاشی اصفهان", "Isfahan tiles"),
  board("khatam", 800, "خاتم‌کاری", "Khatam marquetry"),
  pawns("classic", 0, "کلاسیک", "Classic"),
  pawns("wood", 200, "چوبی", "Wooden"),
  pawns("crystal", 300, "شیشه‌ای", "Crystal"),
  pawns("copper", 400, "مسی", "Copper"),
  pawns("firoozeh", 500, "فیروزه‌کوبی", "Turquoise inlay"),
  pawns("gold", 700, "طلایی", "Gold"),
];

export const DAILY_COINS = 50;
export const FREE_SKUS = ["board:classic", "pawns:classic"] as const;
export const BOARD_THEMES = CATALOG.filter((i) => i.kind === "board").map(
  (i) => i.id as BoardThemeId,
);
export const PAWN_SETS = CATALOG.filter((i) => i.kind === "pawns").map(
  (i) => i.id as PawnSetId,
);
