import { resolveShortcutCommand } from "./keybindings";
import { requestSidebarScope, useSidebarKeyState } from "./lib/sidebarKeyState";
import { openRowContextMenu } from "./lib/sidebarTree";
import { requestWorkspaceFocus } from "./lib/workspaceFocus";
import { appAtomRegistry } from "./rpc/atomRegistry";
import { primaryServerKeybindingsAtom } from "./state/server";
import { focusSidebar } from "./vim-areas";

// Tree-plugin keys for the sidebar, after NERDTree and nvim-tree: Enter or `o` opens a thread
// and jumps to the input box, `l` or `go` opens it and stays, and gt/gT switch environment tabs.

const SIDEBAR = '[data-workspace-area="sidebar"]';
/** Rows that open a conversation: threads and drafts, not folders or shelves. */
export const OPENABLE_ROW = '[data-thread-item] [data-sidebar-row], [data-sidebar-row^="draft:"]';
const STAY_AFTER_OPEN: Readonly<Record<string, boolean>> = {
  Enter: false,
  o: false,
  l: true,
  go: true,
};

/** The sidebar keys, in the order the `?` help lists them. */
export const SIDEBAR_KEYS: ReadonlyArray<{ readonly keys: readonly string[]; label: string }> = [
  { keys: ["Enter", "o"], label: "Open the thread and go to the composer" },
  { keys: ["l", "go"], label: "Open the thread and stay in the sidebar" },
  { keys: ["m"], label: "Open the row's menu" },
  { keys: ["x"], label: "Collapse the section or folder, or expand a collapsed one" },
  { keys: ["X"], label: "Collapse everything, or expand everything" },
  { keys: ["I"], label: "Show or hide Snoozed and Settled" },
  { keys: ["C"], label: "Show only this project" },
  { keys: ["U"], label: "Reset the filter to all projects" },
  { keys: ["F"], label: "Filter by project, then back to the list" },
  { keys: ["1–9"], label: "Open a thread by position, pinned first" },
  { keys: ["A"], label: "Widen the sidebar, or restore it" },
  { keys: ["gt", "gT"], label: "Next or previous environment" },
  { keys: ["?"], label: "Show these keys" },
];

export function openSidebarRow(row: HTMLElement, stay: boolean) {
  row.click();
  if (!stay) {
    requestWorkspaceFocus({ area: "content" });
    return;
  }
  // An opened thread focuses its input box a frame later; staying takes focus back once,
  // unless the user moves on first.
  const selector = `[data-sidebar-row="${CSS.escape(row.dataset.sidebarRow!)}"]`;
  const reclaim = (event: FocusEvent) => {
    stop();
    if (
      event.target instanceof Element &&
      event.target.closest('[data-workspace-area="composer"]')
    ) {
      requestWorkspaceFocus({ area: "sidebar", selector });
    }
  };
  const stop = () => {
    window.removeEventListener("focusin", reclaim);
    window.removeEventListener("keydown", stop, true);
    window.removeEventListener("pointerdown", stop, true);
    clearTimeout(timeout);
  };
  const timeout = setTimeout(stop, 1000);
  window.addEventListener("focusin", reclaim);
  window.addEventListener("keydown", stop, true);
  window.addEventListener("pointerdown", stop, true);
}

/** Runs after React renders what the current frame changed. */
const afterRender = (run: () => void) => requestAnimationFrame(() => requestAnimationFrame(run));

/**
 * Switches environment tab and focuses the sidebar there, ready to pick a thread.
 * Returns whether there were tabs to switch.
 */
function switchEnvironmentTab(step: 1 | -1) {
  const tabs = [...document.querySelectorAll<HTMLElement>(`${SIDEBAR} [role="tab"]`)];
  if (tabs.length < 2) return false;
  const current = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
  tabs[(current + step + tabs.length) % tabs.length]!.click();
  // Focus once the new tab's rows render, landing on its open thread as Option-h does.
  afterRender(focusSidebar);
  return true;
}

/** The environment tab shortcuts, which the sidebar handles, also move focus to the sidebar. */
export function focusSidebarAfterEnvironmentShortcut(event: KeyboardEvent) {
  const command = resolveShortcutCommand(event, appAtomRegistry.get(primaryServerKeybindingsAtom));
  if (command !== "sidebar.previousEnvironment" && command !== "sidebar.nextEnvironment") return;
  if (document.querySelectorAll(`${SIDEBAR} [role="tab"]`).length < 2) return;
  afterRender(focusSidebar);
}

function sidebarRow(id: string | undefined) {
  return id === undefined
    ? null
    : document.querySelector<HTMLElement>(`${SIDEBAR} [data-sidebar-row="${CSS.escape(id)}"]`);
}

const isExpanded = (row: HTMLElement) => row.getAttribute("aria-expanded") === "true";

const pressArrow = (row: Element, key: "ArrowLeft" | "ArrowRight") =>
  row.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

/**
 * NERDTree's `x`: closes the node the row sits in, or the row itself when it is an open one.
 * The tree's ArrowLeft steps to the parent, then a second one collapses it; ArrowRight opens a
 * closed row.
 */
function toggleEnclosing(row: HTMLElement) {
  if (row.getAttribute("aria-expanded") === "false") {
    pressArrow(row, "ArrowRight");
    return;
  }
  if (!isExpanded(row)) pressArrow(row, "ArrowLeft");
  const target = document.activeElement;
  if (target instanceof HTMLElement && isExpanded(target)) pressArrow(target, "ArrowLeft");
}

const rowsExpanded = (expanded: boolean) => [
  ...document.querySelectorAll<HTMLElement>(
    `${SIDEBAR} [data-sidebar-row][aria-expanded="${expanded}"]`,
  ),
];

// Bumped by each `X`, so a press mid-expand stops the levels still to come.
let expandGeneration = 0;

/** Opening a section renders its folders closed, so expanding goes a level per render. */
function expandAll(generation: number, levels = 3) {
  const collapsed = rowsExpanded(false);
  if (generation !== expandGeneration || collapsed.length === 0 || levels === 0) return;
  for (const row of collapsed) row.click();
  afterRender(() => expandAll(generation, levels - 1));
}

function toggleAll() {
  expandGeneration += 1;
  const expanded = rowsExpanded(true);
  if (expanded.length === 0) {
    expandAll(expandGeneration);
    return;
  }
  for (const row of expanded) row.click();
}

let stopFilterWatch: AbortController | undefined;

/** Picking a project returns focus to the filter button, so carry on in the list instead. */
function openProjectFilter() {
  const trigger = document.querySelector<HTMLElement>(
    `${SIDEBAR} [aria-label^="Filter threads by project"]`,
  );
  if (!trigger) return;
  stopFilterWatch?.abort();
  const watch = new AbortController();
  stopFilterWatch = watch;
  // The menu's search box takes focus while it is open; focus anywhere else ends the watch.
  window.addEventListener(
    "focusin",
    (event) => {
      if (event.target instanceof HTMLInputElement) return;
      watch.abort();
      if (event.target === trigger) focusSidebar();
    },
    { signal: watch.signal },
  );
  window.addEventListener("pointerdown", () => watch.abort(), {
    capture: true,
    signal: watch.signal,
  });
  trigger.click();
}

/** Like NERDTree's `I` for hidden files: Snoozed and Settled open or close together. */
function toggleQuietShelves() {
  const shelves = [sidebarRow("shelf:snoozed"), sidebarRow("shelf:settled")].filter(
    (shelf) => shelf !== null,
  );
  const expand = !shelves.some(isExpanded);
  for (const shelf of shelves) if (isExpanded(shelf) !== expand) shelf.click();
}

/** Returns whether the key sequence was used. */
export function handleSidebarKey(sequence: string, active: Element | null) {
  if (!active?.closest(SIDEBAR)) return false;
  switch (sequence) {
    case "gt":
    case "gT":
      switchEnvironmentTab(sequence === "gt" ? 1 : -1);
      return true;
    case "X":
      toggleAll();
      return true;
    case "I":
      toggleQuietShelves();
      return true;
    case "F":
      openProjectFilter();
      return true;
    case "U":
      requestSidebarScope(null);
      return true;
    case "A":
      useSidebarKeyState.setState((state) => ({ zoomed: !state.zoomed }));
      return true;
    case "?":
      useSidebarKeyState.setState({ helpOpen: true });
      return true;
  }
  if (/^[1-9]$/.test(sequence)) {
    // Thread rows render in the Cmd-1 to 9 order, pinned first; those shortcuts are desktop-only.
    const rows = [
      ...document.querySelectorAll<HTMLElement>(`${SIDEBAR} [data-thread-item] [data-sidebar-row]`),
    ];
    const row = rows.filter(
      (candidate) => !candidate.closest('[hidden], [inert], [aria-hidden="true"]'),
    )[Number(sequence) - 1];
    if (row) openSidebarRow(row, true);
    return true;
  }
  const row = active.closest<HTMLElement>("[data-sidebar-row]");
  if (!row) {
    // Off the rows, on a header button such as the filter, ArrowDown would open it.
    if (sequence !== "j" && sequence !== "k") return false;
    focusSidebar();
    return true;
  }
  switch (sequence) {
    case "m":
      openRowContextMenu(row);
      return true;
    case "x":
      toggleEnclosing(row);
      return true;
    case "C":
      requestSidebarScope(row.dataset.sidebarRow!);
      return true;
  }
  if (!row.matches(OPENABLE_ROW) || row.hasAttribute("aria-expanded")) return false;
  const stay = STAY_AFTER_OPEN[sequence];
  if (stay === undefined) return false;
  openSidebarRow(row, stay);
  return true;
}
