import { expect, test } from "vitest";
import { isLocale } from "./index";
test("locale boundary accepts only supported language identifiers", () => {
  expect(isLocale("fa")).toBe(true);
  expect(isLocale("en")).toBe(true);
  for (const input of [null, {}, 1, "FA", "ar"])
    expect(isLocale(input)).toBe(false);
});
