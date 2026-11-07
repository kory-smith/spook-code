import { writeTextToClipboard } from "./hooks/useCopyToClipboard";
import { elementHints, isUncovered, showHints, type HintTarget } from "./vim-hints";

// Surfingkeys-style copying from the conversation: `zv` hints words and starts a visual
// selection at the picked one; `yv` hints blocks and copies the picked block's text.

const CONVERSATION = '[data-workspace-area="conversation"]';
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
  $: ["forward", "lineboundary"],
};

const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
let selecting = false;

/** Hover-only details, such as message timestamps, are hit-testable at zero opacity. */
function isOpaque(element: Element) {
  return element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
}

function copy(text: string) {
  void writeTextToClipboard(text, "selection").catch(() => {});
}

function startVisual(node: Text, offset: number) {
  getSelection()?.setBaseAndExtent(node, offset, node, offset + 1);
  selecting = true;
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
  const blocks = [...area.querySelectorAll<HTMLElement>(BLOCKS)].filter(isOpaque);
  showHints(elementHints(blocks, copyBlock));
}

/** Returns whether the key was used. While a selection is open, plain keys belong to it. */
export function handleTextVisualKey(event: KeyboardEvent) {
  if (!selecting) return false;
  const selection = getSelection();
  // A click or a copy elsewhere ends the selection without us.
  if (!selection || selection.isCollapsed) {
    selecting = false;
    return false;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  if (event.key === "Escape" || event.key === "y") {
    const text = selection.toString();
    selection.removeAllRanges();
    selecting = false;
    if (event.key === "y") copy(text);
    return true;
  }
  if (event.key === "o") {
    const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
    if (anchorNode && focusNode) {
      selection.setBaseAndExtent(focusNode, focusOffset, anchorNode, anchorOffset);
    }
    return true;
  }
  const motion = MOTIONS[event.key];
  if (motion) {
    selection.modify("extend", ...motion);
    selection.focusNode?.parentElement?.scrollIntoView({ block: "nearest" });
  }
  return true;
}
