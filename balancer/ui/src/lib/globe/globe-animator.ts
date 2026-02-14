/**
 * Frame-driven animation manager for the globe.
 * Runs inside the existing render loop — no React state, no re-renders.
 * Animations are queued and executed sequentially (one at a time).
 */

export interface Animation {
  /** Called every frame. Returns false when the animation is complete. */
  update(elapsed: number, deltaTime: number): boolean;
}

export class GlobeAnimator {
  private queue: Animation[] = [];
  private current: Animation | null = null;
  private startTime = 0;

  /** Add an animation to the queue. It will play after all previously queued animations finish. */
  enqueue(animation: Animation): void {
    this.queue.push(animation);
  }

  /** Whether the animator has no current or queued animations. */
  get isIdle(): boolean {
    return this.current === null && this.queue.length === 0;
  }

  /** Called every frame from the render loop. */
  update(deltaTime: number, currentTime: number): void {
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
  }
}
