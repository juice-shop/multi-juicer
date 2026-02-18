import { useEffect, useRef } from "react";

import {
  isChallengeSolvedEvent,
  type ActivityEvent,
} from "@/hooks/useActivityFeed";

/**
 * Watches the activity feed for new challenge-solved events and forwards them
 * to `applySolveEvent`.
 *
 * The first batch of activities is skipped because those events are already
 * reflected in the initial challenge counts from the API. Subsequent updates
 * are detected by comparing event timestamps (activities are sorted newest-first).
 */
export function useActivitySolveProcessor(
  activities: ActivityEvent[] | null,
  applySolveEvent: (
    challengeKey: string,
    solver: string,
    isFirstSolve: boolean
  ) => void
) {
  const hasSeenInitialActivitiesRef = useRef(false);
  const lastProcessedTimestampRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activities || activities.length === 0) return;

    // Skip the first batch — those events are already reflected in the initial challenge counts
    if (!hasSeenInitialActivitiesRef.current) {
      hasSeenInitialActivitiesRef.current = true;
      lastProcessedTimestampRef.current = activities[0].timestamp;
      return;
    }

    // Process only events newer than the last processed timestamp.
    // Activities are sorted newest-first, so we can stop as soon as we hit
    // an event we've already seen.
    for (const event of activities) {
      if (
        lastProcessedTimestampRef.current &&
        event.timestamp <= lastProcessedTimestampRef.current
      ) {
        break;
      }
      if (isChallengeSolvedEvent(event)) {
        applySolveEvent(event.challengeKey, event.team, event.isFirstSolve);
      }
    }

    lastProcessedTimestampRef.current = activities[0].timestamp;
  }, [activities, applySolveEvent]);
}
