import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ReadableTimestamp } from "./ReadableTimestamp";
import { describe, test, expect } from "vitest";

describe(`${ReadableTimestamp.name} Component`, () => {
  test.each([
    {
      date: new Date(Date.now() - 10 * 1000),
      expectedRegex: /10 seconds ago/i,
    },
    {
      date: new Date(Date.now() - 5 * 60 * 1000),
      expectedRegex: /5 minutes ago/i,
    },
    {
      date: new Date(Date.now() - 2 * 60 * 60 * 1000),
      expectedRegex: /2 hours ago/i,
    },
    {
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      expectedRegex: /3 days ago/i,
    },
    {
      date: new Date(Date.now() - 1 * 30 * 24 * 60 * 60 * 1000),
      expectedRegex: /last month/i,
    },
    {
      date: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
      expectedRegex: /2 years ago/i,
    },
  ])("renders correct relative time for date", ({ date, expectedRegex }) => {
    render(<ReadableTimestamp date={date} />);

    const spanElement = screen.getByText(expectedRegex);
    expect(spanElement).toBeInTheDocument();
  });
});
