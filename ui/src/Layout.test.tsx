import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";

import { defaultUIConfig, type UIConfig, uiConfig } from "@/lib/uiConfig";

import { Layout } from "./Layout";

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ data: null }),
}));

vi.mock("@/lib/uiConfig", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/uiConfig")>();
  return { ...original, uiConfig: structuredClone(original.defaultUIConfig) };
});

function renderLayout(views: UIConfig["views"]) {
  uiConfig.views = views;
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
  uiConfig.views = structuredClone(defaultUIConfig.views);
});

describe("Layout navigation", () => {
  test("shows all views by default", () => {
    renderLayout(structuredClone(defaultUIConfig.views));

    expect(
      screen.getByRole("link", { name: "Score Overview" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CTF View" })).toBeInTheDocument();
  });

  test("hides the views disabled in the config", () => {
    renderLayout({
      scoreOverview: { enabled: false },
      ctf: { enabled: false },
    });

    expect(
      screen.queryByRole("link", { name: "Score Overview" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "CTF View" })
    ).not.toBeInTheDocument();
  });
});
