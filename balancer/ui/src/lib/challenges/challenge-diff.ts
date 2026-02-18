import type { Challenge } from "@/hooks/useChallenges";

import { getPatternPathForTeam } from "../patterns/pattern-selector";

export interface NewlySolvedChallenge {
  countryName: string;
  patternPath: string;
  challengeKey: string;
  firstSolver: string;
}

/**
 * Find challenges that were newly solved (went from solveCount=0 to solveCount>0)
 * @param oldChallenges - Previous challenge state (or null for first load)
 * @param newChallenges - Current challenge state
 * @param challengeToCountryMap - Map from challenge key to country name
 * @returns Array of newly solved challenges with their country and pattern info
 */
export function findNewlySolvedChallenges(
  oldChallenges: Challenge[] | null,
  newChallenges: Challenge[],
  challengeToCountryMap: Map<string, string>
): NewlySolvedChallenge[] {
  // If no old challenges, this is the first load - don't trigger transitions
  if (!oldChallenges) {
    return [];
  }

  // Build a map of old challenge states
  const oldSolveStates = new Map<string, { solveCount: number }>();
  for (const challenge of oldChallenges) {
    oldSolveStates.set(challenge.key, { solveCount: challenge.solveCount });
  }

  const newlySolved: NewlySolvedChallenge[] = [];

  for (const challenge of newChallenges) {
    const oldState = oldSolveStates.get(challenge.key);
    const countryName = challengeToCountryMap.get(challenge.key);

    // Skip if no country mapping
    if (!countryName) {
      continue;
    }

    // Check if this challenge went from unsolved to solved
    const wasUnsolved = !oldState || oldState.solveCount === 0;
    const isNowSolved = challenge.solveCount > 0;

    if (wasUnsolved && isNowSolved && challenge.firstSolver) {
      const patternPath = getPatternPathForTeam(challenge.firstSolver);
      newlySolved.push({
        countryName,
        patternPath,
        challengeKey: challenge.key,
        firstSolver: challenge.firstSolver,
      });
    }
  }

  return newlySolved;
}
