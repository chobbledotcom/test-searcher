import { describe, expect, test } from "bun:test";
import {
  DOMMatrixPolyfill,
  installDOMMatrixPolyfill,
} from "../../src/lib/dommatrix-polyfill.ts";

describe("DOMMatrixPolyfill", () => {
  describe("constructor", () => {
    test("creates identity matrix by default", () => {
      const m = new DOMMatrixPolyfill();
      expect(m.a).toBe(1);
      expect(m.b).toBe(0);
      expect(m.c).toBe(0);
      expect(m.d).toBe(1);
      expect(m.e).toBe(0);
      expect(m.f).toBe(0);
      expect(m.isIdentity).toBe(true);
    });

    test("initializes from number array", () => {
      const m = new DOMMatrixPolyfill([2, 3, 4, 5, 6, 7]);
      expect(m.a).toBe(2);
      expect(m.b).toBe(3);
      expect(m.c).toBe(4);
      expect(m.d).toBe(5);
      expect(m.e).toBe(6);
      expect(m.f).toBe(7);
      expect(m.isIdentity).toBe(false);
    });

    test("initializes from matrix string", () => {
      const m = new DOMMatrixPolyfill("matrix(2, 3, 4, 5, 6, 7)");
      expect(m.a).toBe(2);
      expect(m.b).toBe(3);
      expect(m.c).toBe(4);
      expect(m.d).toBe(5);
      expect(m.e).toBe(6);
      expect(m.f).toBe(7);
    });

    test("sets m11-m42 values from 2D matrix", () => {
      const m = new DOMMatrixPolyfill([2, 3, 4, 5, 6, 7]);
      expect(m.m11).toBe(2);
      expect(m.m12).toBe(3);
      expect(m.m21).toBe(4);
      expect(m.m22).toBe(5);
      expect(m.m41).toBe(6);
      expect(m.m42).toBe(7);
    });

    test("ignores short arrays", () => {
      const m = new DOMMatrixPolyfill([1, 2, 3]);
      expect(m.a).toBe(1);
      expect(m.isIdentity).toBe(true);
    });

    test("ignores short matrix strings", () => {
      const m = new DOMMatrixPolyfill("matrix(1, 2)");
      expect(m.a).toBe(1);
      expect(m.isIdentity).toBe(true);
    });
  });

  describe("multiply", () => {
    test("multiplies two identity matrices", () => {
      const m1 = new DOMMatrixPolyfill();
      const m2 = new DOMMatrixPolyfill();
      const result = m1.multiply(m2);
      expect(result.a).toBe(1);
      expect(result.d).toBe(1);
      expect(result.isIdentity).toBe(true);
    });

    test("multiplies translation matrices", () => {
      const m1 = new DOMMatrixPolyfill([1, 0, 0, 1, 10, 20]);
      const m2 = new DOMMatrixPolyfill([1, 0, 0, 1, 5, 10]);
      const result = m1.multiply(m2);
      expect(result.e).toBe(15);
      expect(result.f).toBe(30);
    });

    test("multiplies scale matrices", () => {
      const m1 = new DOMMatrixPolyfill([2, 0, 0, 3, 0, 0]);
      const m2 = new DOMMatrixPolyfill([4, 0, 0, 5, 0, 0]);
      const result = m1.multiply(m2);
      expect(result.a).toBe(8);
      expect(result.d).toBe(15);
    });
  });

  describe("translate", () => {
    test("translates identity matrix", () => {
      const m = new DOMMatrixPolyfill();
      const result = m.translate(10, 20);
      expect(result.e).toBe(10);
      expect(result.f).toBe(20);
    });

    test("translates existing translation", () => {
      const m = new DOMMatrixPolyfill([1, 0, 0, 1, 5, 10]);
      const result = m.translate(10, 20);
      expect(result.e).toBe(15);
      expect(result.f).toBe(30);
    });
  });

  describe("scale", () => {
    test("scales uniformly", () => {
      const m = new DOMMatrixPolyfill();
      const result = m.scale(2);
      expect(result.a).toBe(2);
      expect(result.d).toBe(2);
    });

    test("scales non-uniformly", () => {
      const m = new DOMMatrixPolyfill();
      const result = m.scale(2, 3);
      expect(result.a).toBe(2);
      expect(result.d).toBe(3);
    });

    test("scales existing matrix", () => {
      const m = new DOMMatrixPolyfill([2, 0, 0, 2, 0, 0]);
      const result = m.scale(3);
      expect(result.a).toBe(6);
      expect(result.d).toBe(6);
    });
  });

  describe("transformPoint", () => {
    test("transforms point with identity matrix", () => {
      const m = new DOMMatrixPolyfill();
      const result = m.transformPoint({ x: 10, y: 20 });
      expect(result.x).toBe(10);
      expect(result.y).toBe(20);
    });

    test("transforms point with translation", () => {
      const m = new DOMMatrixPolyfill([1, 0, 0, 1, 5, 10]);
      const result = m.transformPoint({ x: 10, y: 20 });
      expect(result.x).toBe(15);
      expect(result.y).toBe(30);
    });

    test("transforms point with scale", () => {
      const m = new DOMMatrixPolyfill([2, 0, 0, 3, 0, 0]);
      const result = m.transformPoint({ x: 10, y: 20 });
      expect(result.x).toBe(20);
      expect(result.y).toBe(60);
    });
  });

  describe("inverse", () => {
    test("inverts identity matrix", () => {
      const m = new DOMMatrixPolyfill();
      const result = m.inverse();
      expect(result.isIdentity).toBe(true);
    });

    test("inverts translation matrix", () => {
      const m = new DOMMatrixPolyfill([1, 0, 0, 1, 10, 20]);
      const result = m.inverse();
      expect(result.e).toBe(-10);
      expect(result.f).toBe(-20);
    });

    test("inverts scale matrix", () => {
      const m = new DOMMatrixPolyfill([2, 0, 0, 4, 0, 0]);
      const result = m.inverse();
      expect(result.a).toBe(0.5);
      expect(result.d).toBe(0.25);
    });

    test("returns identity for singular matrix", () => {
      const m = new DOMMatrixPolyfill([0, 0, 0, 0, 0, 0]);
      const result = m.inverse();
      expect(result.isIdentity).toBe(true);
    });
  });

  describe("static methods", () => {
    test("fromMatrix creates copy", () => {
      const original = new DOMMatrixPolyfill([2, 3, 4, 5, 6, 7]);
      const copy = DOMMatrixPolyfill.fromMatrix(original);
      expect(copy.a).toBe(2);
      expect(copy.b).toBe(3);
      expect(copy.c).toBe(4);
      expect(copy.d).toBe(5);
      expect(copy.e).toBe(6);
      expect(copy.f).toBe(7);
    });

    test("fromFloat32Array creates matrix", () => {
      const arr = new Float32Array([2, 3, 4, 5, 6, 7]);
      const m = DOMMatrixPolyfill.fromFloat32Array(arr);
      expect(m.a).toBe(2);
      expect(m.f).toBe(7);
    });

    test("fromFloat64Array creates matrix", () => {
      const arr = new Float64Array([2, 3, 4, 5, 6, 7]);
      const m = DOMMatrixPolyfill.fromFloat64Array(arr);
      expect(m.a).toBe(2);
      expect(m.f).toBe(7);
    });
  });
});

describe("installDOMMatrixPolyfill", () => {
  test("does not override existing DOMMatrix", () => {
    const original = globalThis.DOMMatrix;
    installDOMMatrixPolyfill();
    expect(globalThis.DOMMatrix).toBe(original);
  });
});
