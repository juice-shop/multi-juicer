import { useCallback, useEffect, useRef, useState } from "react";

export interface CountdownResult {
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  totalMs: number;
  isExpired: boolean;
  progress?: number;
}

/**
 * Hook that provides a live countdown to an endDate.
 * Uses requestAnimationFrame for smooth updates, throttled to ~50ms React state updates.
 *
 * @param endDate - ISO date string for the countdown target
 * @param startDate - ISO date string for progress calculation (optional)
 * @returns CountdownResult or null when endDate is undefined
 */
export function useCountdown(
  endDate?: string,
  startDate?: string
): CountdownResult | null {
  const [result, setResult] = useState<CountdownResult | null>(null);
  const rafRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  const compute = useCallback((): CountdownResult | null => {
    if (!endDate) return null;

    const endMs = new Date(endDate).getTime();
    const now = Date.now();
    const totalMs = Math.max(0, endMs - now);
    const isExpired = totalMs <= 0;

    const totalSeconds = Math.floor(totalMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((totalMs % 1000) / 10); // 0-99

    let progress: number | undefined;
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      const total = endMs - startMs;
      if (total > 0) {
        progress = Math.min(1, Math.max(0, (now - startMs) / total));
      }
    }

    return {
      hours,
      minutes,
      seconds,
      milliseconds,
      totalMs,
      isExpired,
      progress,
    };
  }, [endDate, startDate]);

  useEffect(() => {
    if (!endDate) {
      setResult(null);
      return;
    }

    // Set initial value immediately
    setResult(compute());

    const tick = (timestamp: number) => {
      // Throttle React state updates to ~50ms
      if (timestamp - lastUpdateRef.current >= 50) {
        lastUpdateRef.current = timestamp;
        const val = compute();
        setResult(val);
        // Stop ticking once expired
        if (val?.isExpired) return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [endDate, startDate, compute]);

  return result;
}
