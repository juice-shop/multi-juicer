import { renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type {
  ActivityEvent,
  ChallengeSolvedEvent,
  TeamCreatedEvent,
} from "@/hooks/useActivityFeed";

import { useActivitySolveProcessor } from "./useActivitySolveProcessor";

function solveEvent(
  overrides: Partial<ChallengeSolvedEvent> & { challengeKey: string }
): ChallengeSolvedEvent {
  return {
    eventType: "challenge_solved",
    team: "team-a",
    timestamp: "2026-02-18T10:00:00Z",
    challengeName: overrides.challengeKey,
    points: 100,
    isFirstSolve: true,
    ...overrides,
  };
}

function teamCreatedEvent(
  overrides?: Partial<TeamCreatedEvent>
): TeamCreatedEvent {
  return {
    eventType: "team_created",
    team: "team-a",
    timestamp: "2026-02-18T10:00:00Z",
    ...overrides,
  };
}

describe("useActivitySolveProcessor", () => {
  test("does not call applySolveEvent on the initial batch of activities", () => {
    const applySolveEvent = vi.fn();
    const initialActivities: ActivityEvent[] = [
      solveEvent({
        challengeKey: "sqlInjection",
        timestamp: "2026-02-18T10:00:00Z",
      }),
    ];

    renderHook(() =>
      useActivitySolveProcessor(initialActivities, applySolveEvent)
    );

    expect(applySolveEvent).not.toHaveBeenCalled();
  });

  test("calls applySolveEvent for new solve events after the initial batch", () => {
    const applySolveEvent = vi.fn();
    const initialActivities: ActivityEvent[] = [
      solveEvent({
        challengeKey: "sqlInjection",
        timestamp: "2026-02-18T10:00:00Z",
      }),
    ];

    const { rerender } = renderHook(
      ({ activities }) =>
        useActivitySolveProcessor(activities, applySolveEvent),
      { initialProps: { activities: initialActivities as ActivityEvent[] } }
    );

    expect(applySolveEvent).not.toHaveBeenCalled();

    // Simulate a new activity arriving (server returns full list, newest first)
    const updatedActivities: ActivityEvent[] = [
      solveEvent({
        challengeKey: "xssChallenge",
        team: "team-b",
        timestamp: "2026-02-18T10:05:00Z",
        isFirstSolve: true,
      }),
      solveEvent({
        challengeKey: "sqlInjection",
        timestamp: "2026-02-18T10:00:00Z",
      }),
    ];

    rerender({ activities: updatedActivities });

    expect(applySolveEvent).toHaveBeenCalledTimes(1);
    expect(applySolveEvent).toHaveBeenCalledWith(
      "xssChallenge",
      "team-b",
      true
    );
  });

  test("does not process events with timestamps <= the last processed timestamp", () => {
    const applySolveEvent = vi.fn();
    const initialActivities: ActivityEvent[] = [
      solveEvent({
        challengeKey: "sqlInjection",
        timestamp: "2026-02-18T10:00:00Z",
      }),
    ];

    const { rerender } = renderHook(
      ({ activities }) =>
        useActivitySolveProcessor(activities, applySolveEvent),
      { initialProps: { activities: initialActivities as ActivityEvent[] } }
    );

    // Re-render with the same data (e.g. long-poll returned same events)
    rerender({ activities: [...initialActivities] });

    expect(applySolveEvent).not.toHaveBeenCalled();
  });

  test("handles multiple new events in a single update", () => {
    const applySolveEvent = vi.fn();
    const initialActivities: ActivityEvent[] = [
      solveEvent({
        challengeKey: "sqlInjection",
        timestamp: "2026-02-18T10:00:00Z",
      }),
    ];

    const { rerender } = renderHook(
      ({ activities }) =>
        useActivitySolveProcessor(activities, applySolveEvent),
      { initialProps: { activities: initialActivities as ActivityEvent[] } }
    );

    // Two new solve events arrive at once
    const updatedActivities: ActivityEvent[] = [
      solveEvent({
        challengeKey: "csrfChallenge",
        team: "team-c",
        timestamp: "2026-02-18T10:10:00Z",
      }),
      solveEvent({
        challengeKey: "xssChallenge",
        team: "team-b",
        timestamp: "2026-02-18T10:05:00Z",
      }),
      solveEvent({
        challengeKey: "sqlInjection",
        timestamp: "2026-02-18T10:00:00Z",
      }),
    ];

    rerender({ activities: updatedActivities });

    expect(applySolveEvent).toHaveBeenCalledTimes(2);
    expect(applySolveEvent).toHaveBeenCalledWith(
      "csrfChallenge",
      "team-c",
      true
    );
    expect(applySolveEvent).toHaveBeenCalledWith(
      "xssChallenge",
      "team-b",
      true
    );
  });

  test("ignores team_created events (only processes challenge_solved)", () => {
    const applySolveEvent = vi.fn();
    const initialActivities: ActivityEvent[] = [
      solveEvent({
        challengeKey: "sqlInjection",
        timestamp: "2026-02-18T10:00:00Z",
      }),
    ];

    const { rerender } = renderHook(
      ({ activities }) =>
        useActivitySolveProcessor(activities, applySolveEvent),
      { initialProps: { activities: initialActivities as ActivityEvent[] } }
    );

    // New batch has a team_created event (not a solve)
    const updatedActivities: ActivityEvent[] = [
      teamCreatedEvent({
        team: "team-new",
        timestamp: "2026-02-18T10:05:00Z",
      }),
      solveEvent({
        challengeKey: "sqlInjection",
        timestamp: "2026-02-18T10:00:00Z",
      }),
    ];

    rerender({ activities: updatedActivities });

    expect(applySolveEvent).not.toHaveBeenCalled();
  });

  test("does nothing when activities is null", () => {
    const applySolveEvent = vi.fn();

    renderHook(() => useActivitySolveProcessor(null, applySolveEvent));

    expect(applySolveEvent).not.toHaveBeenCalled();
  });

  test("does nothing when activities is empty", () => {
    const applySolveEvent = vi.fn();

    renderHook(() => useActivitySolveProcessor([], applySolveEvent));

    expect(applySolveEvent).not.toHaveBeenCalled();
  });

  test("works when array length stays the same (capped at 15)", () => {
    const applySolveEvent = vi.fn();

    // Initial batch of 3 events (simulating capped list)
    const initialActivities: ActivityEvent[] = [
      solveEvent({
        challengeKey: "c3",
        timestamp: "2026-02-18T10:03:00Z",
      }),
      solveEvent({
        challengeKey: "c2",
        timestamp: "2026-02-18T10:02:00Z",
      }),
      solveEvent({
        challengeKey: "c1",
        timestamp: "2026-02-18T10:01:00Z",
      }),
    ];

    const { rerender } = renderHook(
      ({ activities }) =>
        useActivitySolveProcessor(activities, applySolveEvent),
      { initialProps: { activities: initialActivities as ActivityEvent[] } }
    );

    // New event arrives, oldest drops off — array length stays at 3
    const updatedActivities: ActivityEvent[] = [
      solveEvent({
        challengeKey: "c4",
        team: "team-x",
        timestamp: "2026-02-18T10:04:00Z",
      }),
      solveEvent({
        challengeKey: "c3",
        timestamp: "2026-02-18T10:03:00Z",
      }),
      solveEvent({
        challengeKey: "c2",
        timestamp: "2026-02-18T10:02:00Z",
      }),
    ];

    rerender({ activities: updatedActivities });

    expect(applySolveEvent).toHaveBeenCalledTimes(1);
    expect(applySolveEvent).toHaveBeenCalledWith("c4", "team-x", true);
  });

  test("handles successive updates correctly", () => {
    const applySolveEvent = vi.fn();
    const initialActivities: ActivityEvent[] = [
      solveEvent({
        challengeKey: "c1",
        timestamp: "2026-02-18T10:00:00Z",
      }),
    ];

    const { rerender } = renderHook(
      ({ activities }) =>
        useActivitySolveProcessor(activities, applySolveEvent),
      { initialProps: { activities: initialActivities as ActivityEvent[] } }
    );

    // First update
    rerender({
      activities: [
        solveEvent({
          challengeKey: "c2",
          team: "team-a",
          timestamp: "2026-02-18T10:05:00Z",
        }),
        solveEvent({
          challengeKey: "c1",
          timestamp: "2026-02-18T10:00:00Z",
        }),
      ],
    });

    expect(applySolveEvent).toHaveBeenCalledTimes(1);
    expect(applySolveEvent).toHaveBeenCalledWith("c2", "team-a", true);

    // Second update
    rerender({
      activities: [
        solveEvent({
          challengeKey: "c3",
          team: "team-b",
          timestamp: "2026-02-18T10:10:00Z",
        }),
        solveEvent({
          challengeKey: "c2",
          team: "team-a",
          timestamp: "2026-02-18T10:05:00Z",
        }),
        solveEvent({
          challengeKey: "c1",
          timestamp: "2026-02-18T10:00:00Z",
        }),
      ],
    });

    expect(applySolveEvent).toHaveBeenCalledTimes(2);
    expect(applySolveEvent).toHaveBeenCalledWith("c3", "team-b", true);
  });
});
