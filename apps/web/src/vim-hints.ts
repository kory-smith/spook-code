import { ensureLocalApi } from "./localApi";
import { OPENABLE_ROW, openSidebarRow } from "./vim-sidebar";

// Same order as the labels in Kory's VS Code easymotion setup.
const HINT_KEYS = "hklyuiopnm,qwertzxcvbasdgj;'";

export interface HintTarget {
  readonly left: number;
  readonly top: number;
  readonly pick: () => void;
}

interface Hint {
  readonly label: string;
  readonly pick: () => void;
  readonly element: HTMLElement;
}

let hints: ReadonlyArray<Hint> = [];
let overlay: HTMLElement | null = null;
let typed = "";

/** Short labels where they fit, and same-length pairs otherwise so no label prefixes another. */
export function hintLabels(count: number): ReadonlyArray<string> {
  const keys = [...HINT_KEYS];
  if (count <= keys.length) return keys.slice(0, count);
  return keys.flatMap((first) => keys.map((second) => first + second)).slice(0, count);
}

/** Whether a box is on screen and its centre is not covered by something else. */
export function isUncovered(owner: Element, { top, left, right, bottom }: DOMRect) {
  if (right <= left || bottom <= top) return false;
  if (bottom < 0 || right < 0 || top > innerHeight || left > innerWidth) return false;
  const x = Math.min(Math.max((left + right) / 2, 0), innerWidth - 1);
  const y = Math.min(Math.max((top + bottom) / 2, 0), innerHeight - 1);
  return owner.contains(document.elementFromPoint(x, y));
}

/** Hints for the uncovered elements, each measured once. */
export function elementHints(
  elements: Iterable<HTMLElement>,
  pick: (element: HTMLElement) => void,
): HintTarget[] {
  const targets: HintTarget[] = [];
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (isUncovered(element, rect)) {
      targets.push({ left: rect.left, top: rect.top, pick: () => pick(element) });
    }
  }
  return targets;
}

function close() {
  overlay?.remove();
  overlay = null;
  hints = [];
  typed = "";
  window.removeEventListener("blur", close);
  window.removeEventListener("resize", close);
}

function render() {
  for (const hint of hints) hint.element.hidden = !hint.label.startsWith(typed);
}

/** Labels each target; typing a label picks it. Extra targets past the two-key labels are dropped. */
export function showHints(targets: ReadonlyArray<HintTarget>) {
  close();
  if (targets.length === 0) return;
  overlay = document.createElement("div");
  overlay.className = "pointer-events-none fixed inset-0 z-[9999]";
  hints = hintLabels(targets.length).map((label, index) => {
    const { left, top, pick } = targets[index]!;
    const element = document.createElement("span");
    element.className =
      "absolute rounded-sm bg-ring px-1 font-mono text-xs font-semibold text-black uppercase shadow-sm";
    element.style.left = `${Math.max(left, 0)}px`;
    element.style.top = `${Math.max(top, 0)}px`;
    element.textContent = label;
    overlay!.append(element);
    return { label, pick, element };
  });
  document.body.append(overlay);
  window.addEventListener("blur", close);
  window.addEventListener("resize", close);
}

function openLink(target: HTMLElement) {
  if (target instanceof HTMLAnchorElement && /^https?:/.test(target.href)) {
    void ensureLocalApi().shell.openExternal(target.href);
  } else if (target.matches(OPENABLE_ROW)) {
    openSidebarRow(target, false);
  } else {
    target.click();
  }
}

export function showLinkHints() {
  showHints(
    elementHints(document.querySelectorAll<HTMLElement>(`a[href], ${OPENABLE_ROW}`), openLink),
  );
}

/** Returns whether the key was used. While hints show, every key belongs to them. */
export function handleHintKey(event: KeyboardEvent) {
  if (!overlay) return false;
  if (event.key === "Escape") {
    close();
    return true;
  }
  if (event.key === "Backspace") {
    typed = typed.slice(0, -1);
    render();
    return true;
  }
  // Modifier and function keys arrive with long names and are not hint letters.
  if ([...event.key].length !== 1) return true;
  typed += event.key.toLowerCase();
  // Labels share one length, so an exact match is never the prefix of another.
  const match = hints.find((hint) => hint.label === typed);
  if (match || !hints.some((hint) => hint.label.startsWith(typed))) close();
  if (match) match.pick();
  else render();
  return true;
}
