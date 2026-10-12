import { expect, test } from "vitest";
import {
  buy,
  claimDaily,
  equip,
  newWallet,
  rewardAd,
  rewardWin,
  sameHash,
  upgrade,
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
  expect(claimDaily(w, EVENING)).toBe(20);
  expect(claimDaily(w, EVENING + 60_000)).toBe(0);
  expect(view(w, EVENING).dailyAvailable).toBe(false);
  expect(claimDaily(w, AFTER_MIDNIGHT_TEHRAN)).toBe(20);
  expect(w.coins).toBe(40);
});

test("buying needs coins, equips the new design, and cannot repeat", () => {
  const w = newWallet("h", 0);
  expect(w.owned).toEqual(["board:classic", "pawns:classic", "dice:classic"]);
  expect(() => buy(w, "board:wood")).toThrow("INSUFFICIENT_COINS");
  w.coins = 300;
  buy(w, "board:wood");
  expect(w.coins).toBe(50);
  expect(w.equipped).toEqual({
    board: "wood",
    pawns: "classic",
    dice: "classic",
  });
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

test("rewarded ads: 20 coins, 30 s apart, five a Tehran day", () => {
  const w = newWallet("h", EVENING);
  let t = EVENING - 10 * 60_000;
  for (let i = 0; i < 5; i++) {
    expect(rewardAd(w, t)).toBe(20);
    expect(() => rewardAd(w, t + 1000)).toThrow(
      i < 4 ? "AD_TOO_SOON" : "AD_LIMIT",
    );
    t += 31_000;
  }
  expect(w.coins).toBe(100);
  expect(view(w, t).adsLeft).toBe(0);
  expect(() => rewardAd(w, t)).toThrow("AD_LIMIT");
  expect(view(w, AFTER_MIDNIGHT_TEHRAN).adsLeft).toBe(5);
  expect(rewardAd(w, AFTER_MIDNIGHT_TEHRAN)).toBe(20);
});

test("older wallets get the dice they did not have yet", () => {
  const old = {
    ...newWallet("h", 0),
    owned: ["board:classic", "pawns:classic"],
    equipped: { board: "wood", pawns: "classic" },
  } as unknown as Parameters<typeof upgrade>[0];
  upgrade(old);
  expect(old.owned).toContain("dice:classic");
  expect(old.equipped).toEqual({
    board: "wood",
    pawns: "classic",
    dice: "classic",
  });
  buy({ ...old, coins: 150 }, "dice:wood");
});

test("wins: 10 coins five times a day online, 5 coins three times against the bot", () => {
  const w = newWallet("h", EVENING);
  let t = EVENING - 30 * 60_000;
  for (let i = 0; i < 5; i++) expect(rewardWin(w, t + i, "online")).toBe(10);
  expect(() => rewardWin(w, t, "online")).toThrow("WIN_LIMIT");
  expect(view(w, t).winsLeft).toBe(0);
  for (let i = 0; i < 3; i++) {
    expect(rewardWin(w, t, "bot")).toBe(5);
    expect(() => rewardWin(w, t + 1000, "bot")).toThrow(
      i < 2 ? "WIN_TOO_SOON" : "WIN_LIMIT",
    );
    t += 61_000;
  }
  expect(() => rewardWin(w, t, "bot")).toThrow("WIN_LIMIT");
  expect(w.coins).toBe(65);
  expect(view(w, t).onlineWins).toBe(5);
  expect(view(w, t).botWins).toBe(3);
  expect(view(w, AFTER_MIDNIGHT_TEHRAN).winsLeft).toBe(5);
  expect(view(w, AFTER_MIDNIGHT_TEHRAN).botWinsLeft).toBe(3);
  expect(rewardWin(w, AFTER_MIDNIGHT_TEHRAN, "online")).toBe(10);
});
