import { requestWorkspaceFocus } from "./lib/workspaceFocus";
import { focusSidebar } from "./vim-areas";

// Tree-plugin keys for the sidebar, after NERDTree and nvim-tree: Enter or `o` opens a thread
// and jumps to the input box, `l` opens it and stays, and gt/gT switch environment tabs.

const SIDEBAR = '[data-workspace-area="sidebar"]';
/** Rows that open a conversation: threads and drafts, not folders or shelves. */
export const OPENABLE_ROW = '[data-thread-item] [data-sidebar-row], [data-sidebar-row^="draft:"]';

export function openSidebarRow(row: HTMLElement, stay: boolean) {
  row.click();
  if (!stay) {
    requestWorkspaceFocus({ area: "content" });
    return;
  }
  // An opened thread focuses its input box a frame later; staying takes focus back once.
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
    clearTimeout(timeout);
  };
  const timeout = setTimeout(stop, 1000);
  window.addEventListener("focusin", reclaim);
}

function switchEnvironmentTab(step: 1 | -1) {
  const tabs = [...document.querySelectorAll<HTMLElement>(`${SIDEBAR} [role="tab"]`)];
  if (tabs.length < 2) return;
  const current = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
  tabs[(current + step + tabs.length) % tabs.length]!.click();
  // The focused row may belong to the other environment, so land again once the tab renders.
  requestAnimationFrame(() => requestAnimationFrame(focusSidebar));
}

/**
 * Cmd-Shift-[ and Cmd-Shift-] change browser tabs, so in the sidebar they change environment
 * tabs like gT and gt; elsewhere they keep switching threads. Returns whether the key was used.
 */
export function handleSidebarTabShortcut(event: KeyboardEvent) {
  if (!event.metaKey || !event.shiftKey || event.ctrlKey || event.altKey) return false;
  if (event.code !== "BracketLeft" && event.code !== "BracketRight") return false;
  if (!(document.activeElement?.closest(SIDEBAR) ?? null)) return false;
  switchEnvironmentTab(event.code === "BracketRight" ? 1 : -1);
  return true;
}

/** Returns whether the key sequence was used. */
export function handleSidebarKey(sequence: string, active: Element | null) {
  if (!active?.closest(SIDEBAR)) return false;
  if (sequence === "gt" || sequence === "gT") {
    switchEnvironmentTab(sequence === "gt" ? 1 : -1);
    return true;
  }
  const row = active.closest<HTMLElement>("[data-sidebar-row]");
  if (!row?.matches(OPENABLE_ROW) || row.hasAttribute("aria-expanded")) return false;
  if (sequence === "Enter" || sequence === "o") {
    openSidebarRow(row, false);
    return true;
  }
  if (sequence === "l") {
    openSidebarRow(row, true);
    return true;
  }
  return false;
}
