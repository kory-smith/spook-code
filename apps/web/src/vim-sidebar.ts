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
  { keys: ["x"], label: "Collapse the section or folder" },
  { keys: ["X"], label: "Collapse every section and folder" },
  { keys: ["I"], label: "Show or hide Snoozed and Settled" },
  { keys: ["C"], label: "Show only this project" },
  { keys: ["U"], label: "Show all projects" },
  { keys: ["F"], label: "Open the project filter" },
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
  requestAnimationFrame(() => requestAnimationFrame(focusSidebar));
  return true;
}

/** The environment tab shortcuts, which the sidebar handles, also move focus to the sidebar. */
export function focusSidebarAfterEnvironmentShortcut(event: KeyboardEvent) {
  const command = resolveShortcutCommand(event, appAtomRegistry.get(primaryServerKeybindingsAtom));
  if (command !== "sidebar.previousEnvironment" && command !== "sidebar.nextEnvironment") return;
  if (document.querySelectorAll(`${SIDEBAR} [role="tab"]`).length < 2) return;
  requestAnimationFrame(() => requestAnimationFrame(focusSidebar));
}

function sidebarRow(id: string | undefined) {
  return id === undefined
    ? null
    : document.querySelector<HTMLElement>(`${SIDEBAR} [data-sidebar-row="${CSS.escape(id)}"]`);
}

const isExpanded = (row: HTMLElement) => row.getAttribute("aria-expanded") === "true";

const pressArrowLeft = (row: Element) =>
  row.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }),
  );

/**
 * NERDTree's `x`: closes the node the row sits in, or the row itself when it is an open one.
 * The tree's ArrowLeft steps to the parent, then a second one collapses it.
 */
function collapseEnclosing(row: HTMLElement) {
  if (!isExpanded(row)) pressArrowLeft(row);
  const target = document.activeElement;
  if (target instanceof HTMLElement && isExpanded(target)) pressArrowLeft(target);
}

function collapseAll() {
  const expanded = `${SIDEBAR} [data-sidebar-row][aria-expanded="true"]`;
  for (const row of document.querySelectorAll<HTMLElement>(expanded)) {
    row.click();
  }
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
      collapseAll();
      return true;
    case "I":
      toggleQuietShelves();
      return true;
    case "F":
      document
        .querySelector<HTMLElement>(`${SIDEBAR} [aria-label="Filter threads by project"]`)
        ?.click();
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
  if (!row) return false;
  switch (sequence) {
    case "m":
      openRowContextMenu(row);
      return true;
    case "x":
      collapseEnclosing(row);
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
