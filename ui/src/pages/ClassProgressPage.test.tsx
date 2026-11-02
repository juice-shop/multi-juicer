import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";

import { type ClassProgress, useClassProgress } from "@/hooks/useClassProgress";

import { ClassProgressPage } from "./ClassProgressPage";

vi.mock("@/hooks/useClassProgress", () => ({
  useClassProgress: vi.fn(),
}));

const classProgress: ClassProgress = {
  mandatory: [
    {
      key: "scoreBoardChallenge",
      name: "Score Board",
      solveCount: 2,
    },
    {
      key: "loginAdminChallenge",
      name: "Login Admin",
      solveCount: 1,
    },
  ],
  suggested: [
    {
      key: "loginJimChallenge",
      name: "Login Jim",
      solveCount: 1,
    },
  ],
  teams: [
    {
      name: "alpha",
      mandatorySolved: 1,
      suggestedSolved: 0,
      solvedChallenges: ["scoreBoardChallenge"],
    },
    {
      name: "bravo",
      mandatorySolved: 0,
      suggestedSolved: 0,
      solvedChallenges: [],
    },
    {
      name: "charlie",
      mandatorySolved: 2,
      suggestedSolved: 1,
      solvedChallenges: [
        "scoreBoardChallenge",
        "loginAdminChallenge",
        "loginJimChallenge",
      ],
    },
  ],
};

function renderPage(data: ClassProgress | null, error: string | null = null) {
  vi.mocked(useClassProgress).mockReturnValue({
    data,
    isLoading: false,
    error,
  });
  return render(
    <IntlProvider locale="en">
      <MemoryRouter>
        <ClassProgressPage activeTeam="alpha" />
      </MemoryRouter>
    </IntlProvider>
  );
}

function teamOrder(container: HTMLElement) {
  return Array.from(container.querySelectorAll("tbody tr")).map(
    (row) => row.querySelector("td")?.textContent
  );
}

afterEach(() => {
  cleanup();
});

describe("ClassProgressPage", () => {
  test("sorts the teams by name by default and by progress on request", () => {
    const { container } = renderPage(classProgress);

    expect(teamOrder(container)).toEqual(["alpha", "bravo", "charlie"]);

    fireEvent.click(screen.getByRole("button", { name: "By progress" }));

    expect(teamOrder(container)).toEqual(["charlie", "alpha", "bravo"]);
  });

  test("marks teams which solved all mandatory challenges as done", () => {
    const { container } = renderPage(classProgress);

    const statuses = Array.from(container.querySelectorAll("tbody tr")).map(
      (row) => row.querySelectorAll("td")[1].textContent
    );
    expect(statuses).toEqual(["1/2", "0/2", "✓ Done"]);
    expect(
      screen.getByText(/of 3 teams have solved all 2 mandatory challenges/)
    ).toBeInTheDocument();
  });

  test("shows how many teams solved each challenge", () => {
    const { container } = renderPage(classProgress);

    const solveCounts = Array.from(container.querySelectorAll("tfoot td")).map(
      (cell) => cell.textContent
    );
    expect(solveCounts).toEqual(["Solved by", "2", "1", "", "1"]);
  });

  test("shows a hint when no team has joined yet", () => {
    renderPage({ ...classProgress, teams: [] });

    expect(screen.getByText("No teams have joined yet.")).toBeInTheDocument();
  });

  test("tells when no class progress is configured", () => {
    renderPage(null, "Class progress not configured");

    expect(
      screen.getByText("Class progress is not configured.")
    ).toBeInTheDocument();
  });
});
