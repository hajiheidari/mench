import { expect, test } from "vitest";
import { eloDelta } from "./rating";
test("fixed zero-sum Elo rewards upsets and preserves expected bounds", () => {
  expect(eloDelta(1000, 1000)).toBe(16);
  expect(eloDelta(1400, 1000)).toBe(3);
  expect(eloDelta(1000, 1400)).toBe(29);
  expect(eloDelta(1000, 1400) + eloDelta(1400, 1000)).toBe(32);
  expect(() => eloDelta(NaN, 1000)).toThrow("INVALID_RATING");
});
