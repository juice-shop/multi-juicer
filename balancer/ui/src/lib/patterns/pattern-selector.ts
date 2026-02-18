/**
 * Simple hash function for strings
 * Returns consistent hash value for same input
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get pattern index (0-120) for a team name
 * Uses consistent hashing for deterministic assignment
 */
export function getPatternIndexForTeam(teamName: string): number {
  const hash = simpleHash(teamName);
  return hash % 84; // 84 patterns (01-84)
}

/**
 * Get pattern file path from a pattern index
 * @param index - Pattern index (0-83)
 */
export function getPatternPathByIndex(index: number): string {
  const paddedIndex = String(index + 1).padStart(2, "0");
  return `/balancer/patterns/pattern_${paddedIndex}.png`;
}

/**
 * Get pattern file path for a team name
 */
export function getPatternPathForTeam(teamName: string): string {
  if (teamName === "owasp") {
    return "/balancer/patterns/special_owasp.png";
  }
  const index = getPatternIndexForTeam(teamName);
  return getPatternPathByIndex(index);
}
