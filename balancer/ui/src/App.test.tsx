import { test, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "./App";

// Clean up the DOM after each test
afterEach(() => {
  cleanup();
});

test("renders without crashing", () => {
  const { container } = render(<App />);
  expect(container).toBeInTheDocument();
});
