import { describe, expect, test } from "bun:test";
import { isAllNumbers } from "#src/is-all-numbers.js";

describe("isAllNumbers", () => {
  test("returns true for strings containing only digits", () => {
    expect(isAllNumbers("123")).toBe(true);
    expect(isAllNumbers("0")).toBe(true);
    expect(isAllNumbers("9876543210")).toBe(true);
  });

  test("returns false for strings with non-digit characters", () => {
    expect(isAllNumbers("12a3")).toBe(false);
    expect(isAllNumbers("abc")).toBe(false);
    expect(isAllNumbers("12.34")).toBe(false);
    expect(isAllNumbers("12-34")).toBe(false);
    expect(isAllNumbers(" 123")).toBe(false);
    expect(isAllNumbers("123 ")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isAllNumbers("")).toBe(false);
  });
});
