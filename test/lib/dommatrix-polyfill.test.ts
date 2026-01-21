import { describe, expect, test } from "bun:test";
import { installDOMMatrixPolyfill } from "../../src/lib/dommatrix-polyfill.ts";

describe("installDOMMatrixPolyfill", () => {
  test("does not override existing DOMMatrix", () => {
    const original = globalThis.DOMMatrix;
    installDOMMatrixPolyfill();
    expect(globalThis.DOMMatrix).toBe(original);
  });

  test("installs DOMMatrix polyfill when not present", () => {
    // Save original
    const original = globalThis.DOMMatrix;

    // Temporarily remove DOMMatrix
    // @ts-expect-error - intentionally removing for test
    delete globalThis.DOMMatrix;

    // Install should set it
    installDOMMatrixPolyfill();
    expect(globalThis.DOMMatrix).toBeDefined();

    // Restore original
    globalThis.DOMMatrix = original;
  });
});
