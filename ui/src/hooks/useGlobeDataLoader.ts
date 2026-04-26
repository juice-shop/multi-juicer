import { useState, useEffect, useRef } from "react";
import { useIntl } from "react-intl";

import type { Challenge } from "@/hooks/useChallenges";
import {
  mapChallengesToCountries,
  getCountriesByChallengeStatus,
} from "@/lib/challenges/challenge-mapper";
import { CountryGeometryManager } from "@/lib/globe/country-geometry";
import { loadGeoJSON, type CountryData } from "@/lib/globe/data/geojson-loader";

// CSS Color Utilities
function getCSSVariable(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function hexToRgb(hex: string): number[] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255,
      ]
    : [0.0, 1.0, 1.0];
}

export function getThemeColors() {
  return {
    primary: hexToRgb(getCSSVariable("--neon-primary")),
    accent: hexToRgb(getCSSVariable("--neon-accent")),
    secondary: hexToRgb(getCSSVariable("--neon-secondary")),
    glowIntensity: parseFloat(getCSSVariable("--glow-intensity") || "1.5"),
  };
}

export interface PreparedGlobeData {
  countries: CountryData[];
  geometryManager: CountryGeometryManager;
  themeColors: ReturnType<typeof getThemeColors>;
  /** Stable mapping from challenge key to country name (computed once at load) */
  challengeToCountryMap: Map<string, string>;
}

interface UseGlobeDataLoaderResult {
  isLoading: boolean;
  loadingMessage: string;
  loadingProgress: number;
  preparedData: PreparedGlobeData | null;
}

/**
 * Loads all data needed for the globe visualization on mount.
 * Waits for challenges to be available, then loads GeoJSON, computes
 * challenge-to-country mappings, and builds Three.js geometries.
 *
 * Runs only once — subsequent challenge updates are handled incrementally.
 */
export function useGlobeDataLoader(
  challenges: Challenge[] | null,
  challengesLoading: boolean,
  challengesError: string | null
): UseGlobeDataLoaderResult {
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(
    intl.formatMessage({
      id: "ctf.loading.initializing",
      defaultMessage: "Initializing...",
    })
  );
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [preparedData, setPreparedData] = useState<PreparedGlobeData | null>(
    null
  );
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }

    async function loadAllData() {
      try {
        // Wait for challenges to load
        if (challengesLoading) {
          setLoadingMessage(
            intl.formatMessage({
              id: "ctf.loading.challenges",
              defaultMessage: "Loading challenges...",
            })
          );
          setLoadingProgress(0);
          return;
        }

        if (challengesError) {
          setLoadingMessage(`Error loading challenges: ${challengesError}`);
          return;
        }

        if (!challenges) {
          return;
        }

        // Step 1: Load theme colors
        setLoadingMessage(
          intl.formatMessage({
            id: "ctf.loading.theme_colors",
            defaultMessage: "Loading theme colors...",
          })
        );
        setLoadingProgress(10);
        const themeColors = getThemeColors();

        // Step 2: Load GeoJSON data
        setLoadingMessage(
          intl.formatMessage({
            id: "ctf.loading.world_data",
            defaultMessage: "Loading world data...",
          })
        );
        const countries = await loadGeoJSON((progress) => {
          setLoadingProgress(10 + progress * 50);
        });

        // Step 3: Calculate challenge-related countries
        setLoadingMessage("Calculating challenge mappings...");
        setLoadingProgress(60);
        let solved = new Set<string>();
        let countriesWithChallenges = new Set<string>();
        let solvedWithPatterns = new Map<string, string>();
        const challengeToCountryMap = new Map<string, string>();

        if (challenges.length > 0) {
          const mappings = mapChallengesToCountries(challenges, countries);
          const result = getCountriesByChallengeStatus(mappings);
          solved = result.solved;
          solvedWithPatterns = result.solvedWithPatterns;

          // Build stable challenge-to-country map (computed once, reused on each poll)
          for (const mapping of mappings) {
            if (mapping.countryName) {
              challengeToCountryMap.set(
                mapping.challenge.key,
                mapping.countryName
              );
            }
          }

          // Get all countries that have challenges (solved or unsolved)
          countriesWithChallenges = new Set(
            mappings
              .map((m) => m.countryName)
              .filter((name): name is string => name !== null)
          );
        }

        // Step 4: Build geometries
        setLoadingMessage("Building globe...");
        setLoadingProgress(70);
        const geometryManager = new CountryGeometryManager(
          countries,
          solved,
          countriesWithChallenges,
          solvedWithPatterns
        );

        // Step 5: Done
        setLoadingMessage("Setting up effects...");
        setLoadingProgress(90);

        setPreparedData({
          countries,
          geometryManager,
          themeColors,
          challengeToCountryMap,
        });

        setLoadingProgress(100);
        setIsLoading(false);
        hasInitializedRef.current = true;
      } catch (error) {
        console.error("Failed to load data:", error);
        setLoadingMessage(
          `Error: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    loadAllData();
  }, [challenges, challengesLoading, challengesError, intl]);

  return { isLoading, loadingMessage, loadingProgress, preparedData };
}
