import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Challenge } from "@/hooks/useChallenges";
import { loadGeoJSON } from "@/lib/globe/data/geojson-loader";

const { MockCountryGeometryManager } = vi.hoisted(() => ({
  MockCountryGeometryManager: vi.fn(),
}));

// Mock heavy dependencies (Three.js, GeoJSON loading)
vi.mock("@/lib/globe/data/geojson-loader", () => ({
  loadGeoJSON: vi.fn(),
}));

vi.mock("@/lib/globe/country-geometry", () => ({
  CountryGeometryManager: MockCountryGeometryManager,
}));

import { useGlobeDataLoader } from "./useGlobeDataLoader";

const mockCountries = [
  {
    name: "Germany",
    partIndex: 0,
    geometry: {},
    borderGeometry: {},
    properties: { population: 83000000 },
  },
  {
    name: "France",
    partIndex: 0,
    geometry: {},
    borderGeometry: {},
    properties: { population: 67000000 },
  },
];

const mockChallenges: Challenge[] = [
  {
    key: "sqlInjection",
    name: "SQL Injection",
    category: "Injection",
    description: "desc",
    difficulty: 1,
    solveCount: 0,
    firstSolver: null,
  },
  {
    key: "xssChallenge",
    name: "XSS",
    category: "XSS",
    description: "desc",
    difficulty: 2,
    solveCount: 1,
    firstSolver: "team-a",
  },
];

function setupGeoJSONMock() {
  vi.mocked(loadGeoJSON).mockResolvedValue(
    mockCountries as unknown as Awaited<ReturnType<typeof loadGeoJSON>>
  );
}

describe("useGlobeDataLoader", () => {
  beforeEach(() => {
    MockCountryGeometryManager.mockImplementation(function (
      this: Record<string, unknown>
    ) {
      this.wireframeGeometries = [];
      this.patternGeometries = [];
      this.solidGeometries = [];
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("starts in loading state", () => {
    setupGeoJSONMock();

    const { result } = renderHook(() => useGlobeDataLoader(null, true, null));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.preparedData).toBeNull();
    expect(result.current.loadingProgress).toBe(0);
  });

  test("shows loading message while challenges are loading", () => {
    setupGeoJSONMock();

    const { result } = renderHook(() => useGlobeDataLoader(null, true, null));

    expect(result.current.loadingMessage).toBe("Loading challenges...");
  });

  test("shows error message when challenges fail to load", () => {
    setupGeoJSONMock();

    const { result } = renderHook(() =>
      useGlobeDataLoader(null, false, "Network error")
    );

    expect(result.current.loadingMessage).toBe(
      "Error loading challenges: Network error"
    );
    expect(result.current.isLoading).toBe(true);
  });

  test("loads globe data successfully when challenges are available", async () => {
    setupGeoJSONMock();

    const { result } = renderHook(() =>
      useGlobeDataLoader(mockChallenges, false, null)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.preparedData).not.toBeNull();
    expect(result.current.loadingProgress).toBe(100);
    expect(loadGeoJSON).toHaveBeenCalledOnce();
    expect(MockCountryGeometryManager).toHaveBeenCalledOnce();
  });

  test("builds challengeToCountryMap from challenge-country mappings", async () => {
    setupGeoJSONMock();

    const { result } = renderHook(() =>
      useGlobeDataLoader(mockChallenges, false, null)
    );

    await waitFor(() => {
      expect(result.current.preparedData).not.toBeNull();
    });

    const map = result.current.preparedData!.challengeToCountryMap;
    // Challenges are mapped to countries by difficulty ASC then key ASC
    // sqlInjection (difficulty 1) → Germany (highest population)
    // xssChallenge (difficulty 2) → France (second highest population)
    expect(map.get("sqlInjection")).toBe("Germany");
    expect(map.get("xssChallenge")).toBe("France");
  });

  test("only initializes once even if challenges change", async () => {
    setupGeoJSONMock();

    const { result, rerender } = renderHook(
      ({ challenges }) => useGlobeDataLoader(challenges, false, null),
      { initialProps: { challenges: mockChallenges } }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Rerender with different challenges
    const updatedChallenges = mockChallenges.map((c) => ({
      ...c,
      solveCount: c.solveCount + 1,
    }));
    rerender({ challenges: updatedChallenges });

    // loadGeoJSON should still only have been called once
    expect(loadGeoJSON).toHaveBeenCalledOnce();
  });

  test("handles empty challenges array", async () => {
    setupGeoJSONMock();

    const { result } = renderHook(() => useGlobeDataLoader([], false, null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.preparedData).not.toBeNull();
    expect(result.current.preparedData!.challengeToCountryMap.size).toBe(0);
  });

  test("handles GeoJSON loading error", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    vi.mocked(loadGeoJSON).mockRejectedValue(new Error("Failed to fetch"));

    const { result } = renderHook(() =>
      useGlobeDataLoader(mockChallenges, false, null)
    );

    await waitFor(() => {
      expect(result.current.loadingMessage).toBe("Error: Failed to fetch");
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.preparedData).toBeNull();
    consoleErrorSpy.mockRestore();
  });

  test("waits for challenges before loading globe data", async () => {
    setupGeoJSONMock();

    // Start with challenges still loading
    const { result, rerender } = renderHook(
      ({ challenges, loading }) =>
        useGlobeDataLoader(challenges, loading, null),
      {
        initialProps: { challenges: null as Challenge[] | null, loading: true },
      }
    );

    expect(result.current.isLoading).toBe(true);
    expect(loadGeoJSON).not.toHaveBeenCalled();

    // Challenges arrive
    rerender({ challenges: mockChallenges, loading: false });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(loadGeoJSON).toHaveBeenCalledOnce();
    expect(result.current.preparedData).not.toBeNull();
  });

  test("passes solved countries and patterns to CountryGeometryManager", async () => {
    setupGeoJSONMock();

    const { result } = renderHook(() =>
      useGlobeDataLoader(mockChallenges, false, null)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // xssChallenge has solveCount=1 and firstSolver="team-a", mapped to France
    const constructorCall = MockCountryGeometryManager.mock.calls[0];
    const solvedSet = constructorCall[1] as Set<string>;
    const countriesWithChallenges = constructorCall[2] as Set<string>;

    expect(solvedSet.has("France")).toBe(true);
    expect(solvedSet.has("Germany")).toBe(false);
    expect(countriesWithChallenges.has("Germany")).toBe(true);
    expect(countriesWithChallenges.has("France")).toBe(true);
  });
});
