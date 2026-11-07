import { requestWorkspaceFocus } from "./lib/workspaceFocus";

// Ctrl-h/j/k/l move between areas by where they sit on screen, like Ctrl-w h/j/k/l between
// vim windows. The terminal and browser panel keep Ctrl keys for their own programs.

const CURRENT_THREAD_ROW = '[data-sidebar-row][aria-current="page"]';
const MAIN_AREAS = ["composer", "conversation", "home", "pull-requests"];

type Direction = "h" | "j" | "k" | "l";

// Each area's neighbours in reading order; the first visible one wins.
const NEIGHBOURS: Readonly<Record<string, Partial<Record<Direction, readonly string[]>>>> = {
  sidebar: { l: ["content"] },
  conversation: { h: ["sidebar"], l: ["panel", "details"], j: ["composer", "terminal"] },
  composer: { h: ["sidebar"], l: ["panel", "details"], k: ["conversation"], j: ["terminal"] },
  home: { h: ["sidebar"], l: ["panel"] },
  "pull-requests": { h: ["sidebar"], l: ["panel"] },
  details: { h: ["content"], l: ["panel"] },
  panel: { h: ["details", "content"] },
  terminal: { h: ["sidebar"], k: ["composer", "conversation"] },
};

function isShown(area: string) {
  if (area === "content") return MAIN_AREAS.some(isShown);
  const element = document.querySelector(`[data-workspace-area="${area}"]`);
  return element !== null && element.getClientRects().length > 0;
}

/** Lands on the open thread, as tree plugins reveal the open file, or else the first row. */
export function focusSidebar() {
  const row = [CURRENT_THREAD_ROW, "[data-sidebar-row]"].find(
    (selector) => document.querySelector(`[data-workspace-area="sidebar"] ${selector}`) !== null,
  );
  requestWorkspaceFocus(row ? { area: "sidebar", selector: row } : { area: "sidebar" });
}

function focusArea(area: string) {
  if (area === "sidebar") focusSidebar();
  else requestWorkspaceFocus({ area });
}

/** Returns whether the key was used. */
export function handleAreaKey(event: KeyboardEvent) {
  if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
  const direction = event.key as Direction;
  if (!"hjkl".includes(direction) || direction.length !== 1) return false;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("[data-vim-ignore], [role='dialog'], [role='menu']")) return false;
  const from = target?.closest<HTMLElement>("[data-workspace-area]")?.dataset.workspaceArea;
  const next = from ? NEIGHBOURS[from]?.[direction]?.find(isShown) : undefined;
  if (next) focusArea(next);
  // Inside an area the key is spent either way, so Ctrl-h never deletes a character.
  return from !== undefined && NEIGHBOURS[from] !== undefined;
}
