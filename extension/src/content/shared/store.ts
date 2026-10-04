import { useLayoutEffect, useState } from 'preact/hooks';

/** Minimal observable: components re-render when `emit()` is called. */
export class Emitter {
  private listeners = new Set<() => void>();
  version = 0;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.version += 1;
    for (const fn of this.listeners) fn();
  }
}

export function useEmitter(emitter: Emitter): number {
  const [version, setVersion] = useState(emitter.version);
  useLayoutEffect(() => {
    const unsubscribe = emitter.subscribe(() => setVersion(emitter.version));
    // Catch any emit that happened between render and subscription.
    if (emitter.version !== version) setVersion(emitter.version);
    return unsubscribe;
  }, [emitter]);
  return version;
}
