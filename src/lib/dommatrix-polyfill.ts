/**
 * DOMMatrix polyfill for environments that don't have it (Node.js, edge runtimes)
 * pdf-parse uses pdfjs-dist which requires DOMMatrix for text extraction
 */
export class DOMMatrixPolyfill {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  m11 = 1;
  m12 = 0;
  m13 = 0;
  m14 = 0;
  m21 = 0;
  m22 = 1;
  m23 = 0;
  m24 = 0;
  m31 = 0;
  m32 = 0;
  m33 = 1;
  m34 = 0;
  m41 = 0;
  m42 = 0;
  m43 = 0;
  m44 = 1;
  is2D = true;
  isIdentity = true;

  private setFromValues(values: number[]): void {
    this.a = values[0] as number;
    this.b = values[1] as number;
    this.c = values[2] as number;
    this.d = values[3] as number;
    this.e = values[4] as number;
    this.f = values[5] as number;
    this.m11 = this.a;
    this.m12 = this.b;
    this.m21 = this.c;
    this.m22 = this.d;
    this.m41 = this.e;
    this.m42 = this.f;
  }

  constructor(init?: string | number[]) {
    if (typeof init === "string") {
      const values = init
        .replace(/matrix\(|\)/g, "")
        .split(",")
        .map(Number);
      if (values.length >= 6) this.setFromValues(values);
    } else if (Array.isArray(init) && init.length >= 6) {
      this.setFromValues(init);
    }
    this.isIdentity =
      this.a === 1 &&
      this.b === 0 &&
      this.c === 0 &&
      this.d === 1 &&
      this.e === 0 &&
      this.f === 0;
  }

  multiply(other: DOMMatrixPolyfill): DOMMatrixPolyfill {
    const result = new DOMMatrixPolyfill();
    result.a = this.a * other.a + this.c * other.b;
    result.b = this.b * other.a + this.d * other.b;
    result.c = this.a * other.c + this.c * other.d;
    result.d = this.b * other.c + this.d * other.d;
    result.e = this.a * other.e + this.c * other.f + this.e;
    result.f = this.b * other.e + this.d * other.f + this.f;
    return result;
  }

  translate(tx: number, ty: number): DOMMatrixPolyfill {
    const result = new DOMMatrixPolyfill([
      this.a,
      this.b,
      this.c,
      this.d,
      this.e,
      this.f,
    ]);
    result.e = this.a * tx + this.c * ty + this.e;
    result.f = this.b * tx + this.d * ty + this.f;
    return result;
  }

  scale(sx: number, sy?: number): DOMMatrixPolyfill {
    const result = new DOMMatrixPolyfill([
      this.a * sx,
      this.b * sx,
      this.c * (sy ?? sx),
      this.d * (sy ?? sx),
      this.e,
      this.f,
    ]);
    return result;
  }

  transformPoint(point: { x: number; y: number }): { x: number; y: number } {
    return {
      x: this.a * point.x + this.c * point.y + this.e,
      y: this.b * point.x + this.d * point.y + this.f,
    };
  }

  inverse(): DOMMatrixPolyfill {
    const det = this.a * this.d - this.b * this.c;
    if (det === 0) return new DOMMatrixPolyfill();
    return new DOMMatrixPolyfill([
      this.d / det,
      -this.b / det,
      -this.c / det,
      this.a / det,
      (this.c * this.f - this.d * this.e) / det,
      (this.b * this.e - this.a * this.f) / det,
    ]);
  }

  static fromMatrix(other: DOMMatrixPolyfill): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill([
      other.a,
      other.b,
      other.c,
      other.d,
      other.e,
      other.f,
    ]);
  }

  static fromFloat32Array(array: Float32Array): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(Array.from(array));
  }

  static fromFloat64Array(array: Float64Array): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(Array.from(array));
  }
}

/**
 * Install the polyfill if DOMMatrix is not available
 */
export const installDOMMatrixPolyfill = (): void => {
  if (typeof globalThis.DOMMatrix === "undefined") {
    // @ts-expect-error polyfill for environments without DOMMatrix
    globalThis.DOMMatrix = DOMMatrixPolyfill;
  }
};
