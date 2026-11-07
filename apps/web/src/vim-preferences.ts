import { showLinkHints } from "./vim-hints";
import { Vim } from "./vim-engine";
import { showBlockHints, showWordHints } from "./vim-text";
import { runCommand } from "./vim-navigation";

// Personal key preferences, kept out of vim-engine so stock vim stays testable and rebases stay easy.

const registers = Vim.getRegisterController();
const pushText = registers.pushText.bind(registers);

// Deleting never touches a register, and yanks reach the system clipboard. An explicit register
// such as "ay still works, and `m` below is the way to cut.
registers.pushText = (registerName, operator, text, linewise, blockwise) => {
  if (registerName) pushText(registerName, operator, text, linewise, blockwise);
  else if (operator === "yank") pushText("+", operator, text, linewise, blockwise);
};

Vim.noremap("M", '"+D', "normal");
Vim.noremap("m", "d", "operatorPending");

for (const context of ["normal", "visual"]) {
  Vim.noremap("m", '"+d', context);
  Vim.noremap("p", '"+p', context);
  Vim.noremap("P", '"+P', context);
}

// Keeping `linewise` means dj still removes whole lines.
Vim.mapCommand("j", "motion", "moveByDisplayLines", { forward: true, linewise: true }, {});
Vim.mapCommand("k", "motion", "moveByDisplayLines", { forward: false, linewise: true }, {});
Vim.mapCommand("H", "motion", "moveToStartOfDisplayLine", {}, {});
Vim.mapCommand("L", "motion", "moveToEndOfDisplayLine", { inclusive: true }, {});

Vim.noremap("U", "<C-r>", "normal");

// The engine maps a bare <Space> to `l`, which would fire before <Space>f could finish.
// Its types demand a context, but the bare <Space> entry has none and only `undefined` matches it.
Vim.unmap("<Space>", undefined as unknown as string);
Vim.defineAction("showLinkHints", showLinkHints);
Vim.mapCommand("<Space>f", "action", "showLinkHints", {}, { context: "normal" });
// In a text box `gn` belongs to vim, so a new thread takes the same leader as the hints.
Vim.defineAction("newThread", () => runCommand("chat.new"));
Vim.mapCommand("<Space>n", "action", "newThread", {}, { context: "normal" });
// Copying from the conversation works from the input box too, with or without the leader.
Vim.defineAction("showWordHints", showWordHints);
Vim.mapCommand("<Space>v", "action", "showWordHints", {}, { context: "normal" });
Vim.mapCommand("zv", "action", "showWordHints", {}, { context: "normal" });
Vim.defineAction("showBlockHints", showBlockHints);
Vim.mapCommand("<Space>y", "action", "showBlockHints", {}, { context: "normal" });
// The engine has no forced-charwise `v` after an operator, so `yv` drops the yank for the hints.
Vim.map("v", "<Esc><Space>y", "operatorPending");
