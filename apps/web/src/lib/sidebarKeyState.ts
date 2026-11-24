import { create } from "zustand";

/** Sidebar view state that vim's tree keys change from outside React. */
export const useSidebarKeyState = create<{ zoomed: boolean; helpOpen: boolean }>(() => ({
  zoomed: false,
  helpOpen: false,
}));

const scopeListeners = new Set<(row: string | null) => void>();

/** Asks the thread sidebar, which owns the project filter, to scope to a row's project, or with null to clear it. */
export function requestSidebarScope(row: string | null) {
  for (const listener of scopeListeners) listener(row);
}

export function onSidebarScopeRequest(listener: (row: string | null) => void) {
  scopeListeners.add(listener);
  return () => {
    scopeListeners.delete(listener);
  };
}
