import { test, expect, afterEach, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "./App";

// Clean up the DOM after each test
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  // mock fetch
  global.fetch = vi.fn(
    () =>
      Promise.resolve({
        json: () => Promise.resolve({}),
      }) as Promise<Response>
  );
});

test("renders without crashing", () => {
  const { container } = render(<App />);
  expect(container).toBeInTheDocument();
});
