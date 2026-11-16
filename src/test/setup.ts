import "@testing-library/jest-dom";

// Tests that opt into `// @vitest-environment node` (e.g. the database tests in
// src/test/rls) have no `window`; only stub browser APIs when there is one.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
