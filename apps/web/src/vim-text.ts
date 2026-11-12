import { writeTextToClipboard } from "./hooks/useCopyToClipboard";
import { elementHints, isOpaque, isUncovered, showHints, type HintTarget } from "./vim-hints";

// Surfingkeys-style copying from the conversation: `zv` hints words and starts a visual
// selection at the picked one; `yv` hints blocks and copies the picked block's text.

export const CONVERSATION = '[data-workspace-area="conversation"]';
const BLOCKS =
  "[data-message-id] :is(p, pre, li:not(:has(p)), blockquote:not(:has(p)), h1, h2, h3, h4, h5, h6, table)";
// Two-key labels run out here.
const MAX_HINTS = 29 * 29;
const MOTIONS: Readonly<Record<string, readonly [direction: string, granularity: string]>> = {
  h: ["backward", "character"],
  l: ["forward", "character"],
  w: ["forward", "word"],
  e: ["forward", "word"],
  b: ["backward", "word"],
  j: ["forward", "line"],
  k: ["backward", "line"],
  "0": ["backward", "lineboundary"],
  "^": ["backward", "lineboundary"],
  H: ["backward", "lineboundary"],
  $: ["forward", "lineboundary"],
  L: ["forward", "lineboundary"],
  "{": ["backward", "paragraph"],
  "}": ["forward", "paragraph"],
};
// f, F, t, and T stay inside the block they start in, as vim's stay on their line.
const FIND_SCOPE = "p, li, pre, blockquote, h1, h2, h3, h4, h5, h6, td, th";
// `land` puts t and T beside the match. They also search from one character further, so
// repeating them with ; moves on instead of sticking.
const FINDS = {
  f: { forward: true, land: 0, reverse: "F" },
  F: { forward: false, land: 0, reverse: "f" },
  t: { forward: true, land: -1, reverse: "T" },
  T: { forward: false, land: 1, reverse: "t" },
} as const;

type FindKey = keyof typeof FINDS;
type Find = { readonly key: FindKey; readonly char: string };

const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
/** "visual" while a selection is open; a find key while it waits for its character. */
let mode: "off" | "visual" | FindKey = "off";
let lastFind: Find | null = null;

function copy(text: string) {
  void writeTextToClipboard(text, "selection").catch(() => {});
}

function startVisual(node: Text, offset: number) {
  getSelection()?.setBaseAndExtent(node, offset, node, offset + 1);
  mode = "visual";
}

export function showWordHints() {
  const area = document.querySelector(CONVERSATION);
  if (!area) return;
  const walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const targets: HintTarget[] = [];
  for (let node = walker.nextNode(); node && targets.length < MAX_HINTS; node = walker.nextNode()) {
    const text = node as Text;
    const parent = text.parentElement;
    if (!parent || !isOpaque(parent)) continue;
    const box = parent.getBoundingClientRect();
    if (box.bottom < 0 || box.top > innerHeight) continue;
    for (const { index, isWordLike } of segmenter.segment(text.data)) {
      if (!isWordLike) continue;
      range.setStart(text, index);
      range.setEnd(text, index + 1);
      const rect = range.getBoundingClientRect();
      // Hit-testing also rules out screen-reader-only text and words under the input box.
      if (!isUncovered(parent, rect)) continue;
      targets.push({ left: rect.left, top: rect.top, pick: () => startVisual(text, index) });
    }
  }
  showHints(targets);
}

function copyBlock(block: HTMLElement) {
  copy(block.innerText);
  // Selecting the block for a moment shows what was copied.
  const selection = getSelection();
  selection?.selectAllChildren(block);
  setTimeout(() => selection?.removeAllRanges(), 300);
}

export function showBlockHints() {
  const area = document.querySelector(CONVERSATION);
  if (!area) return;
  showHints(elementHints(area.querySelectorAll<HTMLElement>(BLOCKS), copyBlock));
}

function isFindKey(key: string): key is FindKey {
  return Object.hasOwn(FINDS, key);
}

function anchorFollows(selection: Selection, node: Node, offset: number) {
  const point = document.createRange();
  point.setStart(node, offset);
  return point.comparePoint(selection.anchorNode!, selection.anchorOffset) > 0;
}

function textPoint(scope: Element, index: number) {
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  let remaining = index;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const { length } = (node as Text).data;
    if (remaining < length) return { node, offset: remaining };
    remaining -= length;
  }
  return null;
}

/** Moves the selection's end like vim's f, F, t, and T. Returns whether it moved. */
function find({ key, char }: Find, selection: Selection) {
  const { focusNode, focusOffset } = selection;
  const scope = (focusNode instanceof Element ? focusNode : focusNode?.parentElement)?.closest(
    FIND_SCOPE,
  );
  if (!focusNode || !scope) return false;
  const before = document.createRange();
  before.setStart(scope, 0);
  before.setEnd(focusNode, focusOffset);
  // The cursor is the character at the selection's moving end.
  const backward = anchorFollows(selection, focusNode, focusOffset);
  const cursor = before.toString().length - (backward ? 0 : 1);
  const { forward, land } = FINDS[key];
  const skip = 1 + Math.abs(land);
  const text = scope.textContent ?? "";
  const from = forward ? cursor + skip : cursor - skip;
  const match = forward ? text.indexOf(char, from) : from < 0 ? -1 : text.lastIndexOf(char, from);
  const point = match < 0 ? null : textPoint(scope, match + land);
  if (!point) return false;
  const endsBefore = anchorFollows(selection, point.node, point.offset);
  selection.extend(point.node, endsBefore ? point.offset : point.offset + 1);
  return true;
}

/** Returns whether the key was used. While a selection is open, plain keys belong to it. */
export function handleTextVisualKey(event: KeyboardEvent) {
  if (mode === "off") return false;
  const selection = getSelection();
  // A click or a copy elsewhere ends the selection without us.
  if (!selection || selection.isCollapsed) {
    mode = "off";
    return false;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  const { key } = event;
  let moved = false;
  if (mode !== "visual") {
    // Shift on its way to a capital is not the character yet.
    if (key.length > 1 && key !== "Escape") return true;
    if (key !== "Escape") {
      lastFind = { key: mode, char: key };
      moved = find(lastFind, selection);
    }
    mode = "visual";
  } else if (key === "Escape" || key === "v" || key === "y") {
    const text = selection.toString();
    selection.removeAllRanges();
    mode = "off";
    if (key === "y") copy(text);
  } else if (key === "o") {
    const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
    if (anchorNode && focusNode) {
      selection.setBaseAndExtent(focusNode, focusOffset, anchorNode, anchorOffset);
    }
  } else if (isFindKey(key)) {
    mode = key;
  } else if (lastFind && (key === ";" || key === ",")) {
    const repeat = key === ";" ? lastFind : { ...lastFind, key: FINDS[lastFind.key].reverse };
    moved = find(repeat, selection);
  } else if (MOTIONS[key]) {
    selection.modify("extend", ...MOTIONS[key]);
    moved = true;
  }
  if (moved) selection.focusNode?.parentElement?.scrollIntoView({ block: "nearest" });
  return true;
}
