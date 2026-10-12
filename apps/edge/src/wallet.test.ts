import { expect, test } from "vitest";
import {
  buy,
  claimDaily,
  equip,
  newWallet,
  sameHash,
  sha256Hex,
  tehranDay,
  view,
} from "./wallet";

// 2026-10-12 20:00 UTC is already 2026-10-12 23:30 in Tehran; 20:31 UTC is the next day there.
const EVENING = Date.UTC(2026, 9, 12, 20, 0);
const AFTER_MIDNIGHT_TEHRAN = Date.UTC(2026, 9, 12, 20, 31);

test("daily coins once per Tehran day", () => {
  expect(tehranDay(EVENING)).toBe("2026-10-12");
  expect(tehranDay(AFTER_MIDNIGHT_TEHRAN)).toBe("2026-10-13");
  const w = newWallet("h", EVENING);
  expect(view(w, EVENING).dailyAvailable).toBe(true);
  expect(claimDaily(w, EVENING)).toBe(50);
  expect(claimDaily(w, EVENING + 60_000)).toBe(0);
  expect(view(w, EVENING).dailyAvailable).toBe(false);
  expect(claimDaily(w, AFTER_MIDNIGHT_TEHRAN)).toBe(50);
  expect(w.coins).toBe(100);
});

test("buying needs coins, equips the new design, and cannot repeat", () => {
  const w = newWallet("h", 0);
  expect(w.owned).toEqual(["board:classic", "pawns:classic"]);
  expect(() => buy(w, "board:wood")).toThrow("INSUFFICIENT_COINS");
  w.coins = 300;
  buy(w, "board:wood");
  expect(w.coins).toBe(50);
  expect(w.equipped).toEqual({ board: "wood", pawns: "classic" });
  expect(() => buy(w, "board:wood")).toThrow("ALREADY_OWNED");
  expect(() => buy(w, "board:nope")).toThrow("UNKNOWN_ITEM");
  expect(() => equip(w, "pawns:gold")).toThrow("NOT_OWNED");
  equip(w, "board:classic");
  expect(w.equipped.board).toBe("classic");
});

test("token hashes compare in constant time", async () => {
  const a = await sha256Hex("a".repeat(64));
  expect(a).toMatch(/^[a-f0-9]{64}$/);
  expect(sameHash(a, a)).toBe(true);
  expect(sameHash(a, await sha256Hex("b".repeat(64)))).toBe(false);
});
