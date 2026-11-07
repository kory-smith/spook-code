import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Schema from "effect/Schema";

import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

// Baked in at build time: the checkout this fork was built from, whose update script it runs.
declare const __T3CODE_FORK_REPO__: string;

/** Runs the update script in a new Ghostty window, which outlives this app when the script quits it. */
export const startForkUpdate = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.START_FORK_UPDATE_CHANNEL,
  payload: Schema.Undefined,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.forkUpdate.start")(function* () {
    const spawner = yield* Effect.serviceOption(ChildProcessSpawner.ChildProcessSpawner);
    if (Option.isNone(spawner)) return;
    const script = `${__T3CODE_FORK_REPO__}/scripts/fork-update/update.command`;
    const opened = ChildProcess.make("open", [
      "-na",
      "Ghostty",
      "--args",
      "--quit-after-last-window-closed=true",
      "-e",
      script,
    ]);
    yield* spawner.value.exitCode(opened).pipe(Effect.ignore);
  }),
});
