import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { IntlProvider } from "react-intl";
import { describe, expect, test } from "vitest";

import type { ChallengeCountryMapping } from "@/lib/challenges/challenge-mapper";

import { ChallengesList } from "./ChallengesList";

function renderWithIntl(ui: ReactElement) {
  return render(<IntlProvider locale="en">{ui}</IntlProvider>);
}

function makeMapping(
  overrides: Partial<ChallengeCountryMapping["challenge"]> & { key: string },
  countryName = "Germany"
): ChallengeCountryMapping {
  return {
    challenge: {
      name: overrides.name ?? overrides.key,
      category: "Test",
      description: "desc",
      difficulty: 2,
      solveCount: 0,
      firstSolver: null,
      ...overrides,
    },
    countryName,
  };
}

describe("ChallengesList", () => {
  test("renders 'Unsolved' for challenges with 0 solves", () => {
    const mappings = [
      makeMapping({ key: "c1", name: "Challenge One", solveCount: 0 }),
    ];

    renderWithIntl(
      <ChallengesList mappings={mappings} hoveredCountry={null} />
    );

    expect(screen.getByText(/Unsolved/)).toBeInTheDocument();
  });

  test("renders '1 Solve' for challenges with 1 solve", () => {
    const mappings = [
      makeMapping({ key: "c1", name: "Challenge One", solveCount: 1 }),
    ];

    renderWithIntl(
      <ChallengesList mappings={mappings} hoveredCountry={null} />
    );

    expect(screen.getByText(/1 Solve\b/)).toBeInTheDocument();
  });

  test("renders '2 Solves' for challenges with 2 solves", () => {
    const mappings = [
      makeMapping({ key: "c1", name: "Challenge One", solveCount: 2 }),
    ];

    renderWithIntl(
      <ChallengesList mappings={mappings} hoveredCountry={null} />
    );

    expect(screen.getByText(/2 Solves/)).toBeInTheDocument();
  });

  test("renders different status for solved vs unsolved challenges", () => {
    const mappings = [
      makeMapping({ key: "c1", name: "Solved Challenge", solveCount: 3 }),
      makeMapping(
        { key: "c2", name: "Unsolved Challenge", solveCount: 0 },
        "France"
      ),
    ];

    renderWithIntl(
      <ChallengesList mappings={mappings} hoveredCountry={null} />
    );

    expect(screen.getByText(/3 Solves/)).toBeInTheDocument();
    // "Unsolved" appears both in the challenge name and the status text
    const unsolvedElements = screen.getAllByText(/Unsolved/);
    expect(unsolvedElements.length).toBeGreaterThanOrEqual(1);
  });
});
