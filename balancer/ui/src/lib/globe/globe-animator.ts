/**
 * Frame-driven animation manager for the globe.
 * Runs inside the existing render loop — no React state, no re-renders.
 * Animations are queued and executed sequentially (one at a time).
 * Parallel animations run alongside the sequential queue every frame.
 */

export interface Animation {
  /** Called every frame. Returns false when the animation is complete. */
  update(elapsed: number, deltaTime: number): boolean;
}

interface ParallelEntry {
  animation: Animation;
  startTime: number;
}

export class GlobeAnimator {
  private queue: Animation[] = [];
  private current: Animation | null = null;
  private startTime = 0;

  /** Animations that run every frame alongside the sequential queue. */
  private parallel: ParallelEntry[] = [];

  /** Add an animation to the queue. It will play after all previously queued animations finish. */
  enqueue(animation: Animation): void {
    this.queue.push(animation);
  }

  /** Add an animation that runs in parallel with the sequential queue. */
  enqueueParallel(animation: Animation): void {
    // startTime is set on the first update call
    this.parallel.push({ animation, startTime: -1 });
  }

  /** Whether the animator has no current or queued animations. */
  get isIdle(): boolean {
    return (
      this.current === null &&
      this.queue.length === 0 &&
      this.parallel.length === 0
    );
  }

  /** Called every frame from the render loop. */
  update(deltaTime: number, currentTime: number): void {
    // Sequential queue
    if (!this.current && this.queue.length > 0) {
      this.current = this.queue.shift()!;
      this.startTime = currentTime;
    }

    if (this.current) {
      const elapsed = currentTime - this.startTime;
      const running = this.current.update(elapsed, deltaTime);
      if (!running) {
        this.current = null;
      }
    }

    // Parallel animations
    for (let i = this.parallel.length - 1; i >= 0; i--) {
      const entry = this.parallel[i];
      if (entry.startTime < 0) {
        entry.startTime = currentTime;
      }
      const elapsed = currentTime - entry.startTime;
      const running = entry.animation.update(elapsed, deltaTime);
      if (!running) {
        this.parallel.splice(i, 1);
      }
    }
  }
}
