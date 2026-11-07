import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Schema from "effect/Schema";

import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

// Baked in at build time: the checkout this fork was built from and the newest upstream release
// it contains. The app updates itself by running that checkout's update script.
declare const __T3CODE_FORK_REPO__: string;
declare const __T3CODE_FORK_BASE_RELEASE__: string;

export const getForkBaseRelease = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.FORK_BASE_RELEASE_CHANNEL,
  payload: Schema.Undefined,
  result: Schema.String,
  handler: () => Effect.succeed(__T3CODE_FORK_BASE_RELEASE__),
});

/** Runs the update script in a new Ghostty window, which outlives this app when the script quits it. */
export const startForkUpdate = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.START_FORK_UPDATE_CHANNEL,
  payload: Schema.Undefined,
  result: Schema.Boolean,
  handler: Effect.fn("desktop.ipc.forkUpdate.start")(function* () {
    const spawner = yield* Effect.serviceOption(ChildProcessSpawner.ChildProcessSpawner);
    if (Option.isNone(spawner)) return false;
    const script = `${__T3CODE_FORK_REPO__}/scripts/fork-update/update.command`;
    const opened = ChildProcess.make("open", ["-na", "Ghostty", "--args", "-e", script]);
    return yield* spawner.value.exitCode(opened).pipe(
      Effect.map((exitCode) => exitCode === 0),
      Effect.orElseSucceed(() => false),
    );
  }),
});
