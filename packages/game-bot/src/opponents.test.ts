import { expect, test } from "vitest";
import {
  flagForTimeZone,
  matchName,
  randomOpponent,
  searchDelay,
  thinkingDelay,
} from "./opponents";

test("opponents get a flag and a name; pauses stay human-scale", () => {
  let seed = 7;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const names = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const opponent = randomOpponent(random);
    expect(opponent.name).toMatch(/^\p{L}+[\w]*$/u);
    expect(opponent.flag).toMatch(/^\p{Regional_Indicator}{2}$/u);
    names.add(opponent.name);
    const roll = thinkingDelay("roll", random);
    expect(roll).toBeGreaterThanOrEqual(700);
    expect(roll).toBeLessThanOrEqual(3700);
    expect(searchDelay(random)).toBeGreaterThanOrEqual(2200);
  }
  expect(names.size).toBeGreaterThan(50);
  // Edge of the range never indexes past the lists.
  expect(randomOpponent(() => 0.9999999).name.length).toBeGreaterThan(0);
});

test("real players get a time-zone flag and a server-safe name", () => {
  expect(flagForTimeZone("Asia/Tehran")).toBe("🇮🇷");
  expect(flagForTimeZone("America/Chicago")).toBe("🇺🇸");
  expect(flagForTimeZone("Australia/Perth")).toBe("🇦🇺");
  expect(flagForTimeZone("Mars/Base")).toBe("");
  expect(flagForTimeZone(undefined)).toBe("");
  expect(matchName("🇮🇷", "علی!!  😀 رضا", "Guest")).toBe("🇮🇷 علی رضا");
  expect(matchName("", "?!", "Guest")).toBe("Guest");
  expect(matchName("🇮🇷", "x".repeat(40), "Guest")).toHaveLength(29);
});
