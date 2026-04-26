import { useState, useCallback, useEffect, useMemo, useRef } from "react";

import { ChallengesPanel } from "@/components/ctf/ChallengesPanel";
import { Globe, type GlobeHandle } from "@/components/ctf/Globe";
import { LeftPanels } from "@/components/ctf/LeftPanels";
import { Loading } from "@/components/ctf/Loading";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { useActivitySolveProcessor } from "@/hooks/useActivitySolveProcessor";
import { useChallenges, type Challenge } from "@/hooks/useChallenges";
import { useGlobeDataLoader } from "@/hooks/useGlobeDataLoader";
import { findNewlySolvedChallenges } from "@/lib/challenges/challenge-diff";
import type { ChallengeCountryMapping } from "@/lib/challenges/challenge-mapper";
import { getPatternPathForTeam } from "@/lib/patterns/pattern-selector";

export default function CtfPage() {
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

  // Load globe data (GeoJSON, geometries, theme colors) once on mount
  const { isLoading, loadingMessage, loadingProgress, preparedData } =
    useGlobeDataLoader(challenges, challengesLoading, challengesError);

  // Refs for imperative globe updates
  const globeHandleRef = useRef<GlobeHandle | null>(null);
  const previousChallengesRef = useRef<Challenge[] | null>(null);
  const challengesRef = useRef<Challenge[] | null>(null);
  const challengeMappingsRef = useRef<ChallengeCountryMapping[]>([]);

  // Forward activity-feed solve events to the challenge state
  useActivitySolveProcessor(activities, applySolveEvent);

  // Keep challenges ref updated for use in callbacks
  useEffect(() => {
    challengesRef.current = challenges;
  }, [challenges]);

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
