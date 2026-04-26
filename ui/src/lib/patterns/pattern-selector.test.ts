import { describe, expect, test } from "vitest";

import { getPatternPathForTeam } from "./pattern-selector";

describe("getPatternPathForTeam", () => {
  test.each([
    { teamName: "owasp", expected: "/balancer/patterns/special_owasp.png" },
    { teamName: "hackers", expected: "/balancer/patterns/pattern_50.png" },
    { teamName: "team1", expected: "/balancer/patterns/pattern_17.png" },
    { teamName: "a", expected: "/balancer/patterns/pattern_14.png" },
    {
      teamName: "long-team-name-with-many-characters",
      expected: "/balancer/patterns/pattern_77.png",
    },
  ])("returns $expected for team '$teamName'", ({ teamName, expected }) => {
    expect(getPatternPathForTeam(teamName)).toBe(expected);
  });

  // skipping as they are really only relevant for initial confirmation, feel free to reactivate when tinkering with the distribution algorithm
  describe.skip("distribution", () => {
    test("uses all 84 patterns when given enough distinct team names", () => {
      const patternsSeen = new Set<string>();
      // 2000 diverse names should be enough to hit all 84 buckets
      for (let i = 0; i < 2000; i++) {
        const path = getPatternPathForTeam(`generated-team-${i}-${i * 7}`);
        patternsSeen.add(path);
      }
      expect(patternsSeen.size).toBe(84);
    });

    test("distributes 10000 teams across patterns without extreme outliers", () => {
      const counts = new Map<string, number>();
      const totalTeams = 10_000;

      for (let i = 0; i < totalTeams; i++) {
        const path = getPatternPathForTeam(`participant-${i}-x${i * 13}`);
        counts.set(path, (counts.get(path) || 0) + 1);
      }

      const values = [...counts.values()];
      const expectedPerBucket = totalTeams / 84; // ~119
      const min = Math.min(...values);
      const max = Math.max(...values);

      // Allow each bucket to deviate by at most 50% from the expected mean.
      // With a good hash this should be well within bounds, and a 50%
      // threshold makes the test non-flaky even if the hash is mediocre.
      expect(min).toBeGreaterThan(expectedPerBucket * 0.5);
      expect(max).toBeLessThan(expectedPerBucket * 1.5);
    });
  });
});
