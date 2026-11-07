import { describe, expect, it } from "vite-plus/test";

import { hintLabels } from "./vim-link-hints";

describe("hintLabels", () => {
  it("uses one key per link while they fit", () => {
    expect(hintLabels(3)).toEqual(["h", "k", "l"]);
  });

  it("switches every label to pairs so none prefixes another", () => {
    const labels = hintLabels(40);
    expect(new Set(labels).size).toBe(40);
    expect(labels.every((label) => label.length === 2)).toBe(true);
  });
});
