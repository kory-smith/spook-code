/**
 * Variables a Claude Code session exports to the commands it runs. When T3 Code is launched from
 * such a command (the fork update relaunches it from Claude), it inherits them, and so does every
 * terminal and app it opens: a `claude` started there joins that long-gone session, or refuses to
 * start as a nested one. `ClaudeHome.ts` strips most of these again for the Claude processes T3 runs.
 */
const CLAUDE_SESSION_ENV_KEYS = [
  "CLAUDECODE",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CODE_HOST_SESSION_ID",
  "CLAUDE_CODE_CHILD_SESSION",
  "CLAUDE_CODE_SESSION_ATTENDED",
  "CLAUDE_CODE_MESSAGING_SOCKET",
  "CLAUDE_CODE_MESSAGING_TOKEN",
  "CLAUDE_CODE_EXECPATH",
  "CLAUDE_CODE_DESKTOP_APP_VERSION",
  "CLAUDE_EFFORT",
  "CLAUDE_PID",
  "CLAUDE_PLUGIN_DATA",
  "CLAUDE_AGENT_SDK_VERSION",
] as const;

/** Removes a launching Claude session's variables, so nothing this process starts inherits them. */
export function scrubClaudeSessionEnv(env: NodeJS.ProcessEnv = process.env) {
  for (const key of CLAUDE_SESSION_ENV_KEYS) delete env[key];
}
