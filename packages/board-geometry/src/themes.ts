/**
 * Cosmetic board and pawn designs sold for coins. Every design keeps the four
 * classic player colours (red, green, yellow, blue) so seats stay readable;
 * only the material changes. Dice and rules are never affected.
 */
export type BoardThemeId =
  "classic" | "firoozeh" | "khatam" | "kashi" | "wood" | "night";
export type PawnSetId =
  "classic" | "copper" | "firoozeh" | "crystal" | "gold" | "wood";

export type DiceSkinId =
  | "classic"
  | "wood"
  | "marble"
  | "anar"
  | "night"
  | "copper"
  | "firoozeh"
  | "gold";

export interface CatalogItem {
  sku: string;
  kind: "board" | "pawns" | "dice";
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

const dice = (
  id: DiceSkinId,
  price: number,
  fa: string,
  en: string,
): CatalogItem => ({
  sku: `dice:${id}`,
  kind: "dice",
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
  dice("classic", 0, "کلاسیک", "Classic"),
  dice("wood", 150, "چوبی", "Wooden"),
  dice("marble", 200, "مرمر", "Marble"),
  dice("anar", 250, "اناری", "Pomegranate"),
  dice("night", 250, "شب کویر", "Desert night"),
  dice("copper", 300, "مسی", "Copper"),
  dice("firoozeh", 400, "فیروزه‌ای", "Turquoise"),
  dice("gold", 500, "طلایی", "Gold"),
];

/** How each die looks: face gradient, rim, edge shadow and pip colour. */
export interface DiceStyle {
  faceTop: string;
  faceBottom: string;
  rim: string;
  edge: string;
  pip: string;
}
export const DICE_STYLES: Record<DiceSkinId, DiceStyle> = {
  classic: {
    faceTop: "#ffffff",
    faceBottom: "#ece0fb",
    rim: "#fff9dc",
    edge: "#cbb3dd",
    pip: "#473060",
  },
  wood: {
    faceTop: "#ecc690",
    faceBottom: "#c48b52",
    rim: "#f6dcae",
    edge: "#6e3f1c",
    pip: "#3f220c",
  },
  marble: {
    faceTop: "#ffffff",
    faceBottom: "#d6d8e4",
    rim: "#f4f5fb",
    edge: "#8d90a6",
    pip: "#1f2a44",
  },
  anar: {
    faceTop: "#f0505d",
    faceBottom: "#9c1c2a",
    rim: "#ffb3ba",
    edge: "#5e0d16",
    pip: "#fff2e8",
  },
  night: {
    faceTop: "#2f3473",
    faceBottom: "#141836",
    rim: "#8c84d6",
    edge: "#070a1c",
    pip: "#fff3b0",
  },
  copper: {
    faceTop: "#f2a86c",
    faceBottom: "#b4642a",
    rim: "#ffd2a1",
    edge: "#5a2a0e",
    pip: "#fff3e2",
  },
  firoozeh: {
    faceTop: "#52d0ca",
    faceBottom: "#1b8a8d",
    rim: "#bdf4ef",
    edge: "#0b5558",
    pip: "#f6d27a",
  },
  gold: {
    faceTop: "#fff0b0",
    faceBottom: "#d4a02a",
    rim: "#fff6cf",
    edge: "#7a5410",
    pip: "#8e1b1b",
  },
};

export const DAILY_COINS = 20;
export const FREE_SKUS = [
  "board:classic",
  "pawns:classic",
  "dice:classic",
] as const;
/** Coins for watching a rewarded ad in the shop, and how many a day. */
export const AD_COINS = 20;
export const AD_DAILY_LIMIT = 5;
export const BOARD_THEMES = CATALOG.filter((i) => i.kind === "board").map(
  (i) => i.id as BoardThemeId,
);
export const PAWN_SETS = CATALOG.filter((i) => i.kind === "pawns").map(
  (i) => i.id as PawnSetId,
);
export const DICE_SKINS = CATALOG.filter((i) => i.kind === "dice").map(
  (i) => i.id as DiceSkinId,
);
