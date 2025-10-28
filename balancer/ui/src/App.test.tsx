import "@testing-library/jest-dom";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";

// Clean up the DOM after each test
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  // mock fetch
  globalThis.fetch = vi.fn(
    () =>
      Promise.resolve({
        json: () => Promise.resolve({}),
      }) as Promise<Response>
  );

  // mock localStorage
  const localStorageMock = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  globalThis.localStorage = localStorageMock as unknown as Storage;
});

test("renders without crashing", () => {
  const { container } = render(<App />);
  expect(container).toBeInTheDocument();
});
