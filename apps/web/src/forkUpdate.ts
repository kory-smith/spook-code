import { compareSemverVersions } from "@t3tools/shared/semver";
import { useSyncExternalStore } from "react";

import { APP_VERSION } from "./branding";

// Fork builds check upstream for releases they do not contain yet; the update itself runs from
// the fork's source checkout (scripts/fork-update).

const LATEST_RELEASE_URL = "https://api.github.com/repos/pingdotgg/t3code/releases/latest";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let availableRelease: string | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

async function check() {
  // Only fork builds can update themselves.
  if (!window.desktopBridge?.startForkUpdate) return;
  const response = await fetch(LATEST_RELEASE_URL).catch(() => null);
  if (!response?.ok) return;
  const { tag_name: latest } = (await response.json()) as { tag_name?: string };
  const next =
    latest && compareSemverVersions(latest.replace(/^v/, ""), APP_VERSION) > 0 ? latest : null;
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
