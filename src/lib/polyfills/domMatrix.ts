import DOMMatrixPolyfill from "@thednp/dommatrix";

const polyfill = DOMMatrixPolyfill as unknown as typeof globalThis.DOMMatrix;
const globalRef = globalThis as typeof globalThis & {
  DOMMatrix?: typeof globalThis.DOMMatrix;
  DOMMatrixReadOnly?: typeof globalThis.DOMMatrixReadOnly;
};

if (!globalRef.DOMMatrix) {
  globalRef.DOMMatrix = polyfill;
}
if (!globalRef.DOMMatrixReadOnly) {
  globalRef.DOMMatrixReadOnly = polyfill;
}
