import { act } from "@testing-library/react";

/**
 * Drains pending promises and the React state updates that result from them.
 * Use after `renderHook` when the hook kicks off async work on mount and you
 * want to assert on the post-fetch state synchronously.
 */
export async function flushPromises(): Promise<void> {
  await act(async () => {});
}
