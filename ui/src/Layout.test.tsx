import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";

import { type UIConfig, useUIConfig } from "@/hooks/useUIConfig";

import { Layout } from "./Layout";

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ data: null }),
}));

vi.mock("@/hooks/useUIConfig", () => ({
  useUIConfig: vi.fn(),
}));

function renderLayout(uiConfig: UIConfig) {
  vi.mocked(useUIConfig).mockReturnValue(uiConfig);
  render(
    <IntlProvider locale="en">
      <MemoryRouter>
        <Layout
          switchLanguage={() => {}}
          selectedLocale="en"
          activeTeam={null}
          setActiveTeam={() => {}}
        >
          <div />
        </Layout>
      </MemoryRouter>
    </IntlProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Layout navigation", () => {
  test("hides the views disabled in the config", () => {
    renderLayout({ showScoreboardView: true, showCtfView: false });

    expect(
      screen.getByRole("link", { name: "Score Overview" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "CTF View" })
    ).not.toBeInTheDocument();
  });

  test("shows the views enabled in the config", () => {
    renderLayout({ showScoreboardView: false, showCtfView: true });

    expect(
      screen.queryByRole("link", { name: "Score Overview" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CTF View" })).toBeInTheDocument();
  });
});
