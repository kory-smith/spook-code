import { showHints, type HintTarget } from "./vim-hints";

// Surfingkeys-style copying from the conversation: `zv` hints words and starts a visual
// selection at the picked one; `yv` hints blocks and copies the picked block's text.

const CONVERSATION = '[data-workspace-area="conversation"]';
// Screen-reader labels, such as each message's author, have a box but no visible text.
const UNSEEN = '[aria-hidden="true"], [hidden], .sr-only';
const BLOCKS =
  "[data-message-id] :is(p, pre, li:not(:has(p)), blockquote:not(:has(p)), h1, h2, h3, h4, h5, h6, table)";
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

function overlaps(a: DOMRect, b: DOMRect) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** The visible part of the conversation; the input box floats over its bottom. */
function visibleConversation() {
  const area = document.querySelector<HTMLElement>(CONVERSATION);
  if (!area) return null;
  const bounds = area.getBoundingClientRect();
  const composer = document.querySelector("[data-chat-composer-surface]")?.getBoundingClientRect();
  const isVisible = (rect: DOMRect) =>
    rect.width > 0 &&
    rect.top >= bounds.top &&
    rect.bottom <= bounds.bottom &&
    !(composer && overlaps(rect, composer));
  return { area, bounds, isVisible };
}

function startVisual(node: Text, offset: number) {
  getSelection()?.setBaseAndExtent(node, offset, node, offset + 1);
  selecting = true;
}

export function showWordHints() {
  const conversation = visibleConversation();
  if (!conversation) return;
  const { area, bounds, isVisible } = conversation;
  const walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const targets: HintTarget[] = [];
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const parent = node.parentElement;
    if (!parent || parent.closest(UNSEEN)) continue;
    if (!overlaps(parent.getBoundingClientRect(), bounds)) continue;
    for (const { index, isWordLike } of segmenter.segment(node.data)) {
      if (!isWordLike) continue;
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const rect = range.getBoundingClientRect();
      if (!isVisible(rect)) continue;
      const textNode = node;
      targets.push({ left: rect.left, top: rect.top, pick: () => startVisual(textNode, index) });
    }
  }
  showHints(targets);
}

function copyBlock(block: HTMLElement) {
  void navigator.clipboard.writeText(block.innerText);
  // Selecting the block for a moment shows what was copied.
  const selection = getSelection();
  selection?.selectAllChildren(block);
  setTimeout(() => selection?.removeAllRanges(), 300);
}

export function showBlockHints() {
  const conversation = visibleConversation();
  if (!conversation) return;
  const blocks = [...conversation.area.querySelectorAll<HTMLElement>(BLOCKS)];
  showHints(
    blocks
      .filter(
        (block) => !block.closest(UNSEEN) && conversation.isVisible(block.getBoundingClientRect()),
      )
      .map((block) => {
        const { left, top } = block.getBoundingClientRect();
        return { left, top, pick: () => copyBlock(block) };
      }),
  );
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
    if (event.key === "y") void navigator.clipboard.writeText(selection.toString());
    selection.removeAllRanges();
    selecting = false;
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
