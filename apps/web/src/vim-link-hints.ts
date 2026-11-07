import { ensureLocalApi } from "./localApi";

// Same order as the labels in Kory's VS Code easymotion setup.
const HINT_KEYS = "hklyuiopnm,qwertzxcvbasdgj;'";

interface Hint {
  readonly label: string;
  readonly link: HTMLAnchorElement;
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

function isOnScreen(link: HTMLAnchorElement) {
  const { top, left, right, bottom } = link.getBoundingClientRect();
  if (right <= left || bottom <= top) return false;
  if (bottom < 0 || right < 0 || top > innerHeight || left > innerWidth) return false;
  const x = Math.min(Math.max((left + right) / 2, 0), innerWidth - 1);
  const y = Math.min(Math.max((top + bottom) / 2, 0), innerHeight - 1);
  return link.contains(document.elementFromPoint(x, y));
}

function close() {
  overlay?.remove();
  overlay = null;
  hints = [];
  typed = "";
  window.removeEventListener("blur", close);
  window.removeEventListener("resize", close);
}

function open(link: HTMLAnchorElement) {
  if (/^https?:/.test(link.href)) void ensureLocalApi().shell.openExternal(link.href);
  else link.click();
}

function render() {
  for (const hint of hints) hint.element.hidden = !hint.label.startsWith(typed);
}

export function showLinkHints() {
  close();
  const links = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].filter(isOnScreen);
  if (links.length === 0) return;

  overlay = document.createElement("div");
  overlay.className = "pointer-events-none fixed inset-0 z-[9999]";
  const labels = hintLabels(links.length);
  hints = links.map((link, index) => {
    const label = labels[index]!;
    const { left, top } = link.getBoundingClientRect();
    const element = document.createElement("span");
    element.className =
      "absolute rounded-sm bg-primary px-1 font-mono text-xs font-semibold text-primary-foreground uppercase shadow-sm";
    element.style.left = `${Math.max(left, 0)}px`;
    element.style.top = `${Math.max(top, 0)}px`;
    element.textContent = label;
    overlay!.append(element);
    return { label, link, element };
  });
  document.body.append(overlay);
  window.addEventListener("blur", close);
  window.addEventListener("resize", close);
}

/** Returns whether the key was used. While hints show, every key belongs to them. */
export function handleLinkHintKey(event: KeyboardEvent) {
  if (!overlay) return false;
  if (event.key === "Backspace") {
    typed = typed.slice(0, -1);
    render();
    return true;
  }
  if (event.key === "Escape") {
    close();
    return true;
  }
  // Modifier and function keys arrive with long names and are not hint letters.
  if ([...event.key].length !== 1) return true;
  const next = typed + event.key.toLowerCase();
  const matches = hints.filter((hint) => hint.label.startsWith(next));
  if (matches.length === 0) {
    close();
    return true;
  }
  typed = next;
  const [match] = matches;
  if (matches.length === 1 && match!.label === next) {
    close();
    open(match!.link);
    return true;
  }
  render();
  return true;
}
