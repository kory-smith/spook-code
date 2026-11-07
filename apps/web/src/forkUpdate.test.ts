import { describe, expect, it } from "vite-plus/test";

import { isNewerRelease } from "./forkUpdate";

describe("isNewerRelease", () => {
  it.each([
    ["v0.1.8", "v0.1.7", true],
    ["v0.2.0", "v0.1.12", true],
    ["v0.1.10", "v0.1.9", true],
    ["v0.1.7", "v0.1.7", false],
    ["v0.1.6", "v0.1.7", false],
  ])("%s over %s is %s", (candidate, base, expected) => {
    expect(isNewerRelease(candidate, base)).toBe(expected);
  });
});
