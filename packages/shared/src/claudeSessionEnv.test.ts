import { describe, expect, it } from "vite-plus/test";

import { scrubClaudeSessionEnv } from "./claudeSessionEnv.ts";

describe("scrubClaudeSessionEnv", () => {
  it("drops the launching session's variables and keeps the user's Claude config", () => {
    const env: NodeJS.ProcessEnv = {
      CLAUDECODE: "1",
      CLAUDE_CODE_ENTRYPOINT: "t3-code",
      CLAUDE_CODE_SESSION_ID: "session",
      CLAUDE_CODE_MESSAGING_TOKEN: "token",
      CLAUDE_PID: "39689",
      CLAUDE_CONFIG_DIR: "/Users/me/.claude-work",
      PATH: "/usr/bin",
    };

    scrubClaudeSessionEnv(env);

    expect(env).toEqual({ CLAUDE_CONFIG_DIR: "/Users/me/.claude-work", PATH: "/usr/bin" });
  });
});
