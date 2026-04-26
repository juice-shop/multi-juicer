import type { CountryData } from "../globe/data/geojson-loader";
import { getPatternPathForTeam } from "../patterns/pattern-selector";

// Re-export Challenge from the hook
export type { Challenge } from "../../hooks/useChallenges";

export interface CountryPopulation {
  name: string;
  population: number;
}

export interface ChallengeCountryMapping {
  challenge: Challenge;
  countryName: string | null;
  firstSolver?: string | null;
  patternPath?: string;
}

/**
 * Aggregate country populations by name (handles MultiPolygons)
 * @param countries - Array of country data from GeoJSON
 * @returns Array of unique countries with aggregated populations
 */
export function aggregateCountryPopulations(
  countries: CountryData[]
): CountryPopulation[] {
  const populationMap = new Map<string, number>();

  for (const country of countries) {
    const name = country.name;
    const population =
      typeof country.properties?.population === "number"
        ? country.properties.population
        : 0;

    if (populationMap.has(name)) {
      // Country already exists, keep the max population (shouldn't aggregate, just take max)
      populationMap.set(name, Math.max(populationMap.get(name)!, population));
    } else {
      populationMap.set(name, population);
    }
  }

  // Convert to array and sort by population descending
  return Array.from(populationMap.entries())
    .map(([name, population]) => ({ name, population }))
    .sort((a, b) => b.population - a.population);
}

/**
 * Map challenges to countries based on difficulty and population
 * Algorithm:
 * 1. Sort challenges by difficulty (ASC) then by key (ASC)
 * 2. Sort countries by population (DESC)
 * 3. Assign challenges[i] to countries[i]
 *
 * @param challenges - Array of challenges from challenges.json
 * @param countries - Array of country data from GeoJSON
 * @returns Array of challenge-to-country mappings
 */
export function mapChallengesToCountries(
  challenges: Challenge[],
  countries: CountryData[]
): ChallengeCountryMapping[] {
  // Sort challenges: difficulty ASC, then key ASC
  const sortedChallenges = [...challenges].sort((a, b) => {
    const difficultyDiff = a.difficulty - b.difficulty;
    if (difficultyDiff !== 0) return difficultyDiff;
    return a.key.localeCompare(b.key);
  });

  // Aggregate and sort countries by population DESC
  const sortedCountries = aggregateCountryPopulations(countries);

  // Map challenges to countries
  const mappings: ChallengeCountryMapping[] = sortedChallenges.map(
    (challenge, index) => {
      const country = sortedCountries[index];
      const firstSolver = challenge.firstSolver || null;
      const patternPath = firstSolver
        ? getPatternPathForTeam(firstSolver)
        : undefined;

      return {
        challenge,
        countryName: country ? country.name : null,
        firstSolver,
        patternPath,
      };
    }
  );

  return mappings;
}

/**
 * Get sets of countries by challenge solve status
 * @param mappings - Array of challenge-country mappings
 * @returns Object with solved and unsolved country sets, plus pattern mapping
 */
export function getCountriesByChallengeStatus(
  mappings: ChallengeCountryMapping[]
): {
  solved: Set<string>;
  unsolved: Set<string>;
  solvedWithPatterns: Map<string, string>;
} {
  const solved = new Set<string>();
  const unsolved = new Set<string>();
  const solvedWithPatterns = new Map<string, string>();

  for (const mapping of mappings) {
    if (mapping.countryName) {
      if (mapping.challenge.solveCount > 0) {
        solved.add(mapping.countryName);
        if (mapping.patternPath !== undefined) {
          solvedWithPatterns.set(mapping.countryName, mapping.patternPath);
        }
      } else {
        unsolved.add(mapping.countryName);
      }
    }
  }

  return { solved, unsolved, solvedWithPatterns };
}
