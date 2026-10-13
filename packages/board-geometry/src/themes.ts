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
  | "gold"
  | "travertine"
  | "lapis";

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
  dice("wood", 150, "چوب گردو", "Walnut"),
  dice("travertine", 200, "تراورتن", "Travertine"),
  dice("marble", 250, "مرمر سبز", "Green marble"),
  dice("anar", 250, "اناری", "Pomegranate"),
  dice("copper", 300, "مس چکشی", "Hammered copper"),
  dice("firoozeh", 400, "فیروزهٔ نیشابور", "Nishapur turquoise"),
  dice("lapis", 500, "لاجورد", "Lapis lazuli"),
  dice("gold", 600, "طلای حکاکی", "Engraved gold"),
  dice("night", 700, "کهکشان", "Galaxy"),
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
    faceTop: "#9a5a2b",
    faceBottom: "#6a3a1a",
    rim: "#c08a55",
    edge: "#3b1e0b",
    pip: "#f3dfbd",
  },
  travertine: {
    faceTop: "#f1e3c8",
    faceBottom: "#d9c29b",
    rim: "#fff4dc",
    edge: "#a88a5e",
    pip: "#5a4128",
  },
  marble: {
    faceTop: "#2f7a63",
    faceBottom: "#0f3a2f",
    rim: "#8fc7b3",
    edge: "#0c2620",
    pip: "#f4efe2",
  },
  anar: {
    faceTop: "#f0505d",
    faceBottom: "#9c1c2a",
    rim: "#ffb3ba",
    edge: "#5e0d16",
    pip: "#fff2e8",
  },
  copper: {
    faceTop: "#f2a86c",
    faceBottom: "#b4642a",
    rim: "#ffd2a1",
    edge: "#5a2a0e",
    pip: "#4a1d06",
  },
  firoozeh: {
    faceTop: "#52d0ca",
    faceBottom: "#1b8a8d",
    rim: "#bdf4ef",
    edge: "#0b5558",
    pip: "#2c1d0c",
  },
  lapis: {
    faceTop: "#2d4fc4",
    faceBottom: "#0d1a52",
    rim: "#8aa2ff",
    edge: "#08113a",
    pip: "#f2cf63",
  },
  gold: {
    faceTop: "#fff0b0",
    faceBottom: "#d4a02a",
    rim: "#fff6cf",
    edge: "#7a5410",
    pip: "#9b1c1c",
  },
  night: {
    faceTop: "#1b1446",
    faceBottom: "#05040f",
    rim: "#8c84d6",
    edge: "#05040f",
    pip: "#ffffff",
  },
};

export const DAILY_COINS = 20;
/** A won online game against people (checked by the server), a few a day. */
export const WIN_COINS = 10;
export const WIN_DAILY_LIMIT = 5;
/** A won offline game against the bot (reported by the device), fewer and smaller. */
export const BOT_WIN_COINS = 5;
export const BOT_WIN_DAILY_LIMIT = 3;
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
