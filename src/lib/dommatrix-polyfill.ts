/**
 * DOMMatrix polyfill for environments that don't have it (Node.js, edge runtimes)
 * pdf-parse uses pdfjs-dist which requires DOMMatrix for text extraction
 * Uses @thednp/dommatrix for a complete implementation
 */
import CSSMatrix from "@thednp/dommatrix";

/**
 * Install the polyfill if DOMMatrix is not available
 */
export const installDOMMatrixPolyfill = (): void => {
  if (typeof globalThis.DOMMatrix === "undefined") {
    // @ts-expect-error polyfill for environments without DOMMatrix
    globalThis.DOMMatrix = CSSMatrix;
  }
};
