import { useState, useCallback, useEffect, useMemo } from "react";

import { ChallengesPanel } from "@/components/ctf/ChallengesPanel";
import { Globe } from "@/components/ctf/Globe";
import { LeftPanels } from "@/components/ctf/LeftPanels";
import { Loading } from "@/components/ctf/Loading";
import { useChallenges } from "@/hooks/useChallenges";
import {
  mapChallengesToCountries,
  getCountriesByChallengeStatus,
  type ChallengeCountryMapping,
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

function getThemeColors() {
  return {
    primary: hexToRgb(getCSSVariable("--neon-primary")),
    accent: hexToRgb(getCSSVariable("--neon-accent")),
    secondary: hexToRgb(getCSSVariable("--neon-secondary")),
    glowIntensity: parseFloat(getCSSVariable("--glow-intensity") || "1.5"),
  };
}

interface PreparedGlobeData {
  countries: CountryData[];
  geometryManager: CountryGeometryManager;
  themeColors: ReturnType<typeof getThemeColors>;
}

export default function CtfPage() {
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Data states
  const {
    data: challenges,
    isLoading: challengesLoading,
    error: challengesError,
  } = useChallenges();
  const [preparedData, setPreparedData] = useState<PreparedGlobeData | null>(
    null
  );

  // UI states
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [teamsOpen, setTeamsOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);
  const [selectedChallenge, setSelectedChallenge] =
    useState<ChallengeCountryMapping | null>(null);

  const handleCountryHover = useCallback((countryName: string | null) => {
    setHoveredCountry(countryName);
  }, []);

  const handleTeamsToggle = useCallback(() => {
    setTeamsOpen((prev) => !prev);
  }, []);

  const handleActivityToggle = useCallback(() => {
    setActivityOpen((prev) => !prev);
  }, []);

  const handleChallengeClick = useCallback(
    (mapping: ChallengeCountryMapping) => {
      setSelectedChallenge(mapping);
    },
    []
  );

  const handleBackFromDetail = useCallback(() => {
    setSelectedChallenge(null);
  }, []);

  // Compute challenge-country mappings when both are available
  const challengeMappings = useMemo<ChallengeCountryMapping[]>(() => {
    if (!challenges || challenges.length === 0 || !preparedData) {
      return [];
    }
    return mapChallengesToCountries(challenges, preparedData.countries);
  }, [challenges, preparedData]);

  const handleCountryClick = useCallback(
    (countryName: string) => {
      // Find the challenge mapping for this country
      const mapping = challengeMappings.find(
        (m) => m.countryName === countryName
      );
      if (mapping) {
        setSelectedChallenge(mapping);
      }
    },
    [challengeMappings]
  );

  // Load all data on mount and when challenges are loaded
  useEffect(() => {
    async function loadAllData() {
      try {
        // Wait for challenges to load
        if (challengesLoading) {
          setLoadingMessage("Loading challenges...");
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

        console.log("Challenges loaded:", challenges.length);

        // Step 1: Load theme colors
        setLoadingMessage("Loading theme colors...");
        setLoadingProgress(10);
        const themeColors = getThemeColors();
        console.log("Theme colors:", themeColors);

        // Step 2: Load GeoJSON data
        setLoadingMessage("Loading world data...");
        const countries = await loadGeoJSON((progress) => {
          setLoadingProgress(10 + progress * 50);
        });

        // Step 3: Calculate challenge-related countries
        setLoadingMessage("Calculating challenge mappings...");
        setLoadingProgress(60);
        let solved = new Set<string>();
        let countriesWithChallenges = new Set<string>();
        let solvedWithPatterns = new Map<string, number>();
        if (challenges.length > 0) {
          const mappings = mapChallengesToCountries(challenges, countries);
          const result = getCountriesByChallengeStatus(mappings);
          solved = result.solved;
          solvedWithPatterns = result.solvedWithPatterns;

          // Get all countries that have challenges (solved or unsolved)
          countriesWithChallenges = new Set(
            mappings
              .map((m) => m.countryName)
              .filter((name): name is string => name !== null)
          );

          console.log("Solved countries:", Array.from(solved));
          console.log(
            "Countries with challenges:",
            Array.from(countriesWithChallenges)
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
        });

        setLoadingProgress(100);
        setIsLoading(false);
        console.log("All data loaded and prepared");
      } catch (error) {
        console.error("Failed to load data:", error);
        setLoadingMessage(
          `Error: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    loadAllData();
  }, [challenges, challengesLoading, challengesError]);

  // Show loading screen while data is being prepared
  if (isLoading || !preparedData) {
    return (
      <Loading
        isLoading={true}
        message={loadingMessage}
        progress={loadingProgress}
      />
    );
  }

  // Render main application
  return (
    <>
      <Globe
        countries={preparedData.countries}
        geometryManager={preparedData.geometryManager}
        themeColors={preparedData.themeColors}
        onCountryHover={handleCountryHover}
        onCountryClick={handleCountryClick}
      />

      <LeftPanels
        teamsOpen={teamsOpen}
        activityOpen={activityOpen}
        onTeamsToggle={handleTeamsToggle}
        onActivityToggle={handleActivityToggle}
        challengeMappings={challengeMappings}
      />

      {challengeMappings.length > 0 && (
        <ChallengesPanel
          mappings={challengeMappings}
          hoveredCountry={hoveredCountry}
          selectedChallenge={selectedChallenge}
          onChallengeClick={handleChallengeClick}
          onBackFromDetail={handleBackFromDetail}
        />
      )}
    </>
  );
}
