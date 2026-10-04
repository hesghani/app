// A polite request queue: limited concurrency, randomized spacing between
// requests, and a pause switch for when Amazon shows a captcha.

export interface QueueOptions {
  concurrency: number;
  minDelay: number;
  maxDelay: number;
}

export class PoliteQueue {
  private pending: Array<() => Promise<void>> = [];
  private running = 0;
  private paused = false;
  private lastStart = 0;

  constructor(private options: QueueOptions) {}

  setConcurrency(n: number) {
    this.options.concurrency = Math.max(1, Math.min(6, Math.round(n)));
    this.pump();
  }

  get size() {
    return this.pending.length + this.running;
  }

  get isPaused() {
    return this.paused;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.pump();
  }

  clear() {
    this.pending = [];
  }

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push(async () => {
        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        }
      });
      this.pump();
    });
  }

  private pump() {
    while (!this.paused && this.running < this.options.concurrency && this.pending.length) {
      const task = this.pending.shift()!;
      this.running += 1;
      const gap = this.options.minDelay + Math.random() * (this.options.maxDelay - this.options.minDelay);
      const wait = Math.max(0, this.lastStart + gap - Date.now());
      this.lastStart = Date.now() + wait;
      setTimeout(() => {
        task().finally(() => {
          this.running -= 1;
          this.pump();
        });
      }, wait);
    }
  }
}
