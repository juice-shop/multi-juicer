import "@testing-library/jest-dom/vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { defaultUIConfig, uiConfig } from "@/lib/uiConfig";

import App from "./App";

vi.mock("@/lib/uiConfig", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/uiConfig")>();
  return { ...original, uiConfig: structuredClone(original.defaultUIConfig) };
});

afterEach(() => {
  cleanup();
  uiConfig.views = structuredClone(defaultUIConfig.views);
  window.history.pushState({}, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
  vi.stubGlobal("localStorage", localStorageMock);

  // Suppress Router basename warning in test environment
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

test("renders without crashing", () => {
  const { container } = render(<App />);
  expect(container).toBeInTheDocument();
});

describe("disabled views", () => {
  test.each([
    ["/multi-juicer/ctf", { ctf: { enabled: false } }],
    ["/multi-juicer/score-overview", { scoreOverview: { enabled: false } }],
    [
      "/multi-juicer/score-overview/teams/foobar",
      { scoreOverview: { enabled: false } },
    ],
  ])("%s redirects to the start page", async (path, views) => {
    uiConfig.views = { ...uiConfig.views, ...views };
    window.history.pushState({}, "", path);

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/multi-juicer");
    });
  });
});
