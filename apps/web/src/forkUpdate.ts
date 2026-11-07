import { useSyncExternalStore } from "react";

// Fork builds check upstream for releases they do not contain yet; the update itself runs from
// the fork's source checkout (scripts/fork-update).

const LATEST_RELEASE_URL = "https://api.github.com/repos/pingdotgg/t3code/releases/latest";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let availableRelease: string | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

/** Compares `vX.Y.Z` tags numerically. */
export function isNewerRelease(candidate: string, base: string) {
  const parts = (tag: string) => tag.replace(/^v/, "").split(".").map(Number);
  const [next, current] = [parts(candidate), parts(base)];
  for (let index = 0; index < Math.max(next.length, current.length); index++) {
    const difference = (next[index] ?? 0) - (current[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

async function check() {
  const base = await window.desktopBridge?.getForkBaseRelease?.();
  if (!base) return;
  const response = await fetch(LATEST_RELEASE_URL).catch(() => null);
  if (!response?.ok) return;
  const { tag_name: latest } = (await response.json()) as { tag_name?: string };
  const next = latest && isNewerRelease(latest, base) ? latest : null;
  if (next === availableRelease) return;
  availableRelease = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    void check();
    timer = setInterval(() => void check(), CHECK_INTERVAL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    clearInterval(timer);
    timer = undefined;
  };
}

/** The upstream release this fork build can update to, or null. */
export function useForkUpdate() {
  return useSyncExternalStore(subscribe, () => availableRelease);
}

export function startForkUpdate() {
  void window.desktopBridge?.startForkUpdate?.();
}
