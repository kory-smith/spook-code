// `{` and `}` step between turns by pressing the timeline minimap's own Previous/Next turn
// buttons, which already handle the virtualized list, then flash the user message they land on.

import { TIMELINE_MINIMAP } from "./vim-hints";
import { CONVERSATION } from "./vim-text";

const USER_MESSAGE = '[data-timeline-row-kind="message"][data-message-role="user"]';
// The jump animates unless motion is reduced; `scrollend` is the usual signal, this the backstop.
const SETTLE_TIMEOUT = 1000;

function flashTurnAtTop(area: Element) {
  const top = area.getBoundingClientRect().top;
  let landed: HTMLElement | undefined;
  let distance = Infinity;
  for (const row of area.querySelectorAll<HTMLElement>(USER_MESSAGE)) {
    const rowDistance = Math.abs(row.getBoundingClientRect().top - top);
    if (rowDistance < distance) [landed, distance] = [row, rowDistance];
  }
  landed?.animate(
    [
      { backgroundColor: "color-mix(in srgb, var(--ring) 22%, transparent)" },
      { backgroundColor: "transparent" },
    ],
    { duration: 900, easing: "ease-out" },
  );
}

let cancelPendingFlash = () => {};

export function jumpTurn(direction: "Previous" | "Next") {
  const area = document.querySelector(CONVERSATION);
  const button = area?.querySelector<HTMLButtonElement>(
    `${TIMELINE_MINIMAP} button[aria-label="${direction} turn"]`,
  );
  if (!area || !button || button.disabled) return;
  // Pressing again before the scroll settles flashes only where the last press lands.
  cancelPendingFlash();
  const stop = () => {
    clearTimeout(timeout);
    area.removeEventListener("scrollend", settle, true);
  };
  const settle = () => {
    stop();
    flashTurnAtTop(area);
  };
  cancelPendingFlash = stop;
  const timeout = setTimeout(settle, SETTLE_TIMEOUT);
  // `scrollend` does not bubble, but capture still reaches the area from the list's scroller.
  area.addEventListener("scrollend", settle, true);
  button.click();
}
