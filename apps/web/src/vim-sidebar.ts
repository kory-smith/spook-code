import { threadTraversalDirectionFromCommand, resolveShortcutCommand } from "./keybindings";
import { requestWorkspaceFocus } from "./lib/workspaceFocus";
import { appAtomRegistry } from "./rpc/atomRegistry";
import { primaryServerKeybindingsAtom } from "./state/server";
import { focusSidebar } from "./vim-areas";

// Tree-plugin keys for the sidebar, after NERDTree and nvim-tree: Enter or `o` opens a thread
// and jumps to the input box, `l` opens it and stays, and gt/gT switch environment tabs.

const SIDEBAR = '[data-workspace-area="sidebar"]';
/** Rows that open a conversation: threads and drafts, not folders or shelves. */
export const OPENABLE_ROW = '[data-thread-item] [data-sidebar-row], [data-sidebar-row^="draft:"]';
const STAY_AFTER_OPEN: Readonly<Record<string, boolean>> = { Enter: false, o: false, l: true };

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
  // Focus once the new tab's rows render, landing on its open thread as Ctrl-h does.
  requestAnimationFrame(() => requestAnimationFrame(focusSidebar));
  return true;
}

/**
 * The previous/next thread shortcuts (Cmd-Shift-[ and ] by default, like browser tabs) switch
 * environment tabs instead while there are tabs, and move focus to the sidebar.
 */
export function handleEnvironmentTabShortcut(event: KeyboardEvent) {
  if (!event.metaKey && !event.ctrlKey) return false;
  const keybindings = appAtomRegistry.get(primaryServerKeybindingsAtom);
  const direction = threadTraversalDirectionFromCommand(resolveShortcutCommand(event, keybindings));
  return direction !== null && switchEnvironmentTab(direction === "next" ? 1 : -1);
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
  const stay = STAY_AFTER_OPEN[sequence];
  if (stay === undefined) return false;
  openSidebarRow(row, stay);
  return true;
}
