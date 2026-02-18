import { useState, useCallback, useEffect, useMemo, useRef } from "react";

import { ChallengesPanel } from "@/components/ctf/ChallengesPanel";
import { Globe, type GlobeHandle } from "@/components/ctf/Globe";
import { LeftPanels } from "@/components/ctf/LeftPanels";
import { Loading } from "@/components/ctf/Loading";
import {
  useActivityFeed,
  isChallengeSolvedEvent,
} from "@/hooks/useActivityFeed";
import { useChallenges, type Challenge } from "@/hooks/useChallenges";
import { findNewlySolvedChallenges } from "@/lib/challenges/challenge-diff";
import {
  mapChallengesToCountries,
  getCountriesByChallengeStatus,
  type ChallengeCountryMapping,
} from "@/lib/challenges/challenge-mapper";
import { CountryGeometryManager } from "@/lib/globe/country-geometry";
import { loadGeoJSON, type CountryData } from "@/lib/globe/data/geojson-loader";
import { getPatternPathForTeam } from "@/lib/patterns/pattern-selector";

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
  /** Stable mapping from challenge key to country name (computed once at load) */
  challengeToCountryMap: Map<string, string>;
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
    applySolveEvent,
  } = useChallenges();
  const {
    data: activities,
    isLoading: activitiesLoading,
    error: activitiesError,
  } = useActivityFeed();
  const [preparedData, setPreparedData] = useState<PreparedGlobeData | null>(
    null
  );

  // Refs for imperative globe updates
  const globeHandleRef = useRef<GlobeHandle | null>(null);
  const previousChallengesRef = useRef<Challenge[] | null>(null);
  const hasInitializedRef = useRef(false);
  const challengesRef = useRef<Challenge[] | null>(null);
  const challengeMappingsRef = useRef<ChallengeCountryMapping[]>([]);

  // Track whether we've seen the first activity batch (skip it for incremental updates)
  const hasSeenInitialActivitiesRef = useRef(false);
  const previousActivitiesLengthRef = useRef(0);

  // Keep challenges ref updated for use in callbacks
  useEffect(() => {
    challengesRef.current = challenges;
  }, [challenges]);

  // Apply solve events from activity feed to challenge data
  useEffect(() => {
    if (!activities) return;

    // Skip the first batch — those events are already reflected in the initial challenge counts
    if (!hasSeenInitialActivitiesRef.current) {
      hasSeenInitialActivitiesRef.current = true;
      previousActivitiesLengthRef.current = activities.length;
      return;
    }

    // Process only new events (activity feed grows by appending to the front or replacing)
    const prevLength = previousActivitiesLengthRef.current;
    const newEvents = activities.slice(0, activities.length - prevLength);
    previousActivitiesLengthRef.current = activities.length;

    for (const event of newEvents) {
      if (isChallengeSolvedEvent(event)) {
        applySolveEvent(event.challengeKey, event.team, event.isFirstSolve);
      }
    }
  }, [activities, applySolveEvent]);

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

  const handleGlobeReady = useCallback((handle: GlobeHandle) => {
    globeHandleRef.current = handle;
    // Initialize the baseline for challenge diffing
    if (challengesRef.current && !previousChallengesRef.current) {
      previousChallengesRef.current = challengesRef.current;
    }
  }, []);

  // Enrich challenges with cached country mappings and current solve data
  // The country assignment is stable (from preparedData), only solve status changes
  const challengeMappings = useMemo<ChallengeCountryMapping[]>(() => {
    if (!challenges || challenges.length === 0 || !preparedData) {
      return [];
    }

    // Use the stable challenge-to-country map computed at load time
    const mappings: ChallengeCountryMapping[] = challenges.map((challenge) => {
      const countryName =
        preparedData.challengeToCountryMap.get(challenge.key) ?? null;
      const firstSolver = challenge.firstSolver || null;
      const patternPath = firstSolver
        ? getPatternPathForTeam(firstSolver)
        : undefined;

      return {
        challenge,
        countryName,
        firstSolver,
        patternPath,
      };
    });

    challengeMappingsRef.current = mappings; // Keep ref in sync for stable callbacks
    return mappings;
  }, [challenges, preparedData]);

  const handleCountryClick = useCallback((countryName: string) => {
    // Find the challenge mapping for this country (reads from ref for stability)
    const mapping = challengeMappingsRef.current.find(
      (m) => m.countryName === countryName
    );
    if (mapping) {
      setSelectedChallenge(mapping);
    }
  }, []); // NO dependencies - reads from ref for bulletproof stability

  // Detect newly solved challenges and transition them on the globe
  useEffect(() => {
    if (!challenges || !globeHandleRef.current || !preparedData) {
      return;
    }

    const newlySolved = findNewlySolvedChallenges(
      previousChallengesRef.current,
      challenges,
      preparedData.challengeToCountryMap // Use stable map from initial load
    );

    // Animate newly solved countries (sorted by geographic proximity for smooth camera path)
    globeHandleRef.current.focusAndHighlightCountries(
      newlySolved.map((s) => ({
        countryName: s.countryName,
        patternPath: s.patternPath,
      }))
    );

    // Update the previous challenges ref
    previousChallengesRef.current = challenges;
  }, [challenges, preparedData]); // preparedData is stable after initial load

  // Load all data on mount (runs only once)
  useEffect(() => {
    // Skip if already initialized
    if (hasInitializedRef.current) {
      return;
    }

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

        // Step 1: Load theme colors
        setLoadingMessage("Loading theme colors...");
        setLoadingProgress(10);
        const themeColors = getThemeColors();

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
        onGlobeReady={handleGlobeReady}
      />

      <LeftPanels
        teamsOpen={teamsOpen}
        activityOpen={activityOpen}
        onTeamsToggle={handleTeamsToggle}
        onActivityToggle={handleActivityToggle}
        challengeMappings={challengeMappings}
        activities={activities}
        activitiesLoading={activitiesLoading}
        activitiesError={activitiesError}
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
