import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { type Challenge, useChallenges } from "@/hooks/useChallenges";
import {
  type ClassProgressTeam,
  useClassProgress,
} from "@/hooks/useClassProgress";
import { defaultUIConfig, uiConfig } from "@/lib/uiConfig";

import { ClassProgressPage } from "./ClassProgressPage";

vi.mock("@/hooks/useClassProgress", () => ({
  useClassProgress: vi.fn(),
}));

vi.mock("@/hooks/useChallenges", () => ({
  useChallenges: vi.fn(),
}));

vi.mock("@/lib/uiConfig", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/uiConfig")>();
  return { ...original, uiConfig: structuredClone(original.defaultUIConfig) };
});

const teams: ClassProgressTeam[] = [
  {
    name: "charlie",
    solvedChallenges: [
      "scoreBoardChallenge",
      "loginAdminChallenge",
      "loginJimChallenge",
    ],
  },
  { name: "alpha", solvedChallenges: ["scoreBoardChallenge"] },
  { name: "bravo", solvedChallenges: [] },
];

function renderPage() {
  vi.mocked(useClassProgress).mockReturnValue({
    data: teams,
    isLoading: false,
    error: null,
  });
  vi.mocked(useChallenges).mockReturnValue({
    data: [
      { key: "scoreBoardChallenge", name: "Score Board" },
      { key: "loginAdminChallenge", name: "Login Admin" },
      { key: "loginJimChallenge", name: "Login Jim" },
    ] as Challenge[],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    applySolveEvent: vi.fn(),
  });
  return render(
    <IntlProvider locale="en">
      <MemoryRouter>
        <ClassProgressPage activeTeam="alpha" />
      </MemoryRouter>
    </IntlProvider>
  );
}

function column(container: HTMLElement, index: number) {
  return Array.from(container.querySelectorAll("tbody tr")).map(
    (row) => row.querySelectorAll("td")[index].textContent
  );
}

beforeEach(() => {
  uiConfig.views.classProgress = {
    enabled: true,
    groups: [
      {
        name: "Week 1",
        challenges: ["scoreBoardChallenge", "loginAdminChallenge"],
      },
      { name: "Bonus", challenges: ["loginJimChallenge"] },
    ],
  };
});

afterEach(() => {
  cleanup();
  uiConfig.views = structuredClone(defaultUIConfig.views);
});

describe("ClassProgressPage", () => {
  test("shows the groups with the names of their challenges", () => {
    renderPage();

    expect(
      screen.getByRole("columnheader", { name: "Week 1" })
    ).toHaveAttribute("colspan", "2");
    expect(screen.getByRole("link", { name: "Login Admin" })).toHaveAttribute(
      "href",
      "/score-overview/challenges/loginAdminChallenge"
    );
  });

  test("shows the progress of each team and how many teams solved each challenge", () => {
    const { container } = renderPage();

    expect(column(container, 0)).toEqual(["alpha", "bravo", "charlie"]);
    expect(column(container, 1)).toEqual(["1/3", "0/3", "3/3"]);
    expect(
      Array.from(container.querySelectorAll("tfoot td")).map(
        (cell) => cell.textContent
      )
    ).toEqual(["Solved by", "2", "1", "", "1"]);
    expect(
      screen.getByText(/of 3 teams have solved all 3 challenges/)
    ).toBeInTheDocument();
  });

  test("sorts the teams by progress on request", () => {
    const { container } = renderPage();

    fireEvent.click(screen.getByRole("button", { name: "By progress" }));

    expect(column(container, 0)).toEqual(["charlie", "alpha", "bravo"]);
  });

  test("shows the names without links when the score overview is disabled", () => {
    uiConfig.views.scoreOverview = { enabled: false };
    renderPage();

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("Login Admin")).toBeInTheDocument();
  });
});
