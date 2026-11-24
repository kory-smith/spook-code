import { useState } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { render } from "../test/render";
import { attachSidebarTree } from "./lib/sidebarTree";
import { startVimMode } from "./vim-mode";

const settings = vi.hoisted(() => ({ vimModeEnabled: true }));
const listeners = vi.hoisted(() => new Set<() => void>());

vi.mock("./hooks/useSettings", () => ({
  getClientSettings: () => settings,
  subscribeClientSettings: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
}));
vi.mock("./rpc/atomRegistry", () => ({
  appAtomRegistry: {
    get: () => [
      {
        command: "thread.next",
        shortcut: {
          key: "]",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          modKey: true,
        },
      },
    ],
  },
}));
vi.mock("./state/server", () => ({ primaryServerKeybindingsAtom: {} }));
const focusRequests = vi.hoisted(() => vi.fn());
vi.mock(import("./lib/workspaceFocus"), async (importOriginal) => ({
  ...(await importOriginal()),
  requestWorkspaceFocus: focusRequests,
}));

function useVimMode() {
  settings.vimModeEnabled = true;
  const stop = startVimMode();
  return {
    [Symbol.dispose]() {
      settings.vimModeEnabled = false;
      for (const listener of listeners) listener();
      stop();
    },
  };
}

function Field({ initial, onSubmit }: { initial: string; onSubmit?: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <textarea
        aria-label="field"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <output aria-label="state">{value}</output>
      <button type="button" onClick={() => setValue("")}>
        clear
      </button>
    </form>
  );
}

async function focusField(screen: { getByLabelText(text: string): unknown }) {
  await userEvent.click(screen.getByLabelText("field") as never);
  // The adapter loads on first focus, and it starts in insert mode.
  await vi.waitFor(async () => {
    await userEvent.keyboard("{Escape}");
    expect(document.querySelector("[data-vim-mode-label]")).not.toBeNull();
  });
}

function textOf() {
  return document.querySelector("output")?.textContent;
}

describe("textareas", () => {
  it("edits a React-controlled textarea", async () => {
    using _vim = useVimMode();
    await using screen = await render(<Field initial="one two three" />);
    await focusField(screen);
    await userEvent.keyboard("0wdw");
    expect(textOf()).toBe("one three");
    await userEvent.keyboard("u");
    expect(textOf()).toBe("one two three");
  });

  it("undoes a typed insert as one step", async () => {
    using _vim = useVimMode();
    await using screen = await render(<Field initial="a" />);
    await focusField(screen);
    await userEvent.keyboard("A one two{Escape}u");
    expect(textOf()).toBe("a");
  });

  it("blocks typing in normal mode and shows the mode", async () => {
    using _vim = useVimMode();
    await using screen = await render(<Field initial="hello" />);
    await focusField(screen);
    expect(document.querySelector("[data-vim-mode-label]")?.textContent).toBe("NORMAL");
    await userEvent.keyboard("zQ");
    expect(textOf()).toBe("hello");
  });

  it("never edits on Enter in normal mode", async () => {
    using _vim = useVimMode();
    await using screen = await render(<Field initial="hello" />);
    await focusField(screen);
    await userEvent.keyboard("{Enter}");
    expect(textOf()).toBe("hello");
  });

  it("keeps Escape from reaching the page while leaving insert mode", async () => {
    using _vim = useVimMode();
    await using screen = await render(<Field initial="hello" />);
    await focusField(screen);
    await userEvent.keyboard("i");
    const reachedPage = vi.fn();
    document.addEventListener("keydown", reachedPage);
    await userEvent.keyboard("{Escape}");
    document.removeEventListener("keydown", reachedPage);
    expect(reachedPage).not.toHaveBeenCalled();
  });

  it("returns to insert when the form clears it", async () => {
    using _vim = useVimMode();
    await using screen = await render(<Field initial="hello" />);
    await focusField(screen);
    (document.querySelector("button") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(textOf()).toBe(""));
    await userEvent.click(screen.getByLabelText("field"));
    await userEvent.keyboard("hi");
    expect(textOf()).toBe("hi");
  });

  it("leaves terminal-style hidden inputs alone", async () => {
    using _vim = useVimMode();
    await using screen = await render(<textarea aria-label="sink" data-vim-ignore="" />);
    await userEvent.click(screen.getByLabelText("sink"));
    await userEvent.keyboard("{Escape}dd");
    expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("dd");
  });

  it("stops when the setting turns off", async () => {
    using _vim = useVimMode();
    await using screen = await render(<Field initial="hello" />);
    await focusField(screen);
    settings.vimModeEnabled = false;
    for (const listener of listeners) listener();
    await userEvent.keyboard("x");
    expect(document.querySelector("[data-vim-mode-label]")).toBeNull();
  });
});

function Pane() {
  return (
    <main style={{ height: 100, overflowY: "auto" }} data-testid="pane">
      <div style={{ height: 2000 }} />
    </main>
  );
}

describe("navigation", () => {
  it.each([
    ["j", 60],
    ["d", 50],
    ["{Control>}d{/Control}", 40],
    ["G", 1900],
  ])("%s scrolls the pane", async (key, top) => {
    using _vim = useVimMode();
    await using _screen = await render(<Pane />);
    await userEvent.keyboard(key);
    await vi.waitFor(() => expect(document.querySelector("main")?.scrollTop).toBeCloseTo(top, -1));
  });

  it("returns to the top with gg", async () => {
    using _vim = useVimMode();
    await using _screen = await render(<Pane />);
    await userEvent.keyboard("Ggg");
    await vi.waitFor(() => expect(document.querySelector("main")?.scrollTop).toBe(0));
  });

  it("runs a command through the user's own shortcut", async () => {
    using _vim = useVimMode();
    await using _screen = await render(<Pane />);
    const seen: KeyboardEvent[] = [];
    const record = (event: KeyboardEvent) => seen.push(event);
    window.addEventListener("keydown", record);
    await userEvent.keyboard("J");
    window.removeEventListener("keydown", record);
    const synthetic = seen.find((event) => !event.isTrusted);
    expect(synthetic?.key).toBe("]");
    expect(synthetic?.metaKey || synthetic?.ctrlKey).toBe(true);
  });

  it("moves through a focused list with arrows", async () => {
    using _vim = useVimMode();
    const onKeyDown = vi.fn();
    await using screen = await render(
      <ul role="listbox" onKeyDown={(event) => onKeyDown(event.key)}>
        <li role="option" aria-selected tabIndex={0}>
          one
        </li>
      </ul>,
    );
    (screen.container.querySelector("li") as HTMLElement).focus();
    await userEvent.keyboard("j");
    expect(onKeyDown).toHaveBeenCalledWith("ArrowDown");
  });

  it("leaves editable fields to them", async () => {
    using _vim = useVimMode();
    await using screen = await render(<input aria-label="search" />);
    await userEvent.click(screen.getByLabelText("search"));
    await userEvent.keyboard("jk");
    expect((document.querySelector("input") as HTMLInputElement).value).toBe("jk");
  });

  it("clicks a button picked from f hints", async () => {
    using _vim = useVimMode();
    const onClick = vi.fn();
    await using _screen = await render(
      <button type="button" aria-label="Run in terminal" onClick={onClick} />,
    );
    await userEvent.keyboard("fh");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("extends a zv selection with find motions", async () => {
    using _vim = useVimMode();
    await using _screen = await render(
      <div data-workspace-area="conversation">
        <p>alpha beta, gamma</p>
      </div>,
    );
    const selected = () => getSelection()?.toString();
    // `h` is the first hint label, on "alpha".
    await userEvent.keyboard("zvh");
    await userEvent.keyboard("t,");
    expect(selected()).toBe("alpha beta");
    await userEvent.keyboard("fa");
    expect(selected()).toBe("alpha beta, ga");
    await userEvent.keyboard(";");
    expect(selected()).toBe("alpha beta, gamma");
    await userEvent.keyboard(",");
    expect(selected()).toBe("alpha beta, ga");
    await userEvent.keyboard("F ");
    expect(selected()).toBe("alpha beta, ");
    await userEvent.keyboard("L");
    expect(selected()).toBe("alpha beta, gamma");
    await userEvent.keyboard("{Escape}");
    expect(selected()).toBe("");
  });

  it("does nothing with the setting off", async () => {
    await using _screen = await render(<Pane />);
    await userEvent.keyboard("j");
    expect(document.querySelector("main")?.scrollTop).toBe(0);
  });
});

function SidebarTree({
  onOpen,
  onMenu,
  onFilter,
}: {
  onOpen?: () => void;
  onMenu?: () => void;
  onFilter?: () => void;
}) {
  const [expanded, setExpanded] = useState({ snoozed: true, settled: false });
  return (
    <nav data-workspace-area="sidebar" ref={attachSidebarTree}>
      <button type="button" aria-label="Filter threads by project" onClick={onFilter}>
        filter
      </button>
      {(["snoozed", "settled"] as const).map((shelf) => (
        <button
          key={shelf}
          type="button"
          data-sidebar-row={`shelf:${shelf}`}
          aria-expanded={expanded[shelf]}
          onClick={() => setExpanded((current) => ({ ...current, [shelf]: !current[shelf] }))}
        >
          {shelf}
        </button>
      ))}
      <li data-thread-item="thread-1">
        <button
          type="button"
          data-sidebar-row="thread-1"
          data-sidebar-parent="shelf:snoozed"
          onClick={onOpen}
          onContextMenu={onMenu}
        >
          thread
        </button>
      </li>
    </nav>
  );
}

describe("sidebar tree keys", () => {
  const focusThread = () =>
    document.querySelector<HTMLElement>('[data-sidebar-row="thread-1"]')!.focus();
  const expandedOf = (shelf: string) =>
    document.querySelector(`[data-sidebar-row="shelf:${shelf}"]`)?.getAttribute("aria-expanded");

  it("opens with go and stays, where o leaves for the composer", async () => {
    using _vim = useVimMode();
    focusRequests.mockClear();
    const onOpen = vi.fn();
    await using _screen = await render(<SidebarTree onOpen={onOpen} />);
    focusThread();
    await userEvent.keyboard("go");
    expect(onOpen).toHaveBeenCalledOnce();
    expect(focusRequests).not.toHaveBeenCalledWith({ area: "content" });
    await userEvent.keyboard("o");
    expect(focusRequests).toHaveBeenCalledWith({ area: "content" });
  });

  it("opens the row's menu with m", async () => {
    using _vim = useVimMode();
    const onMenu = vi.fn();
    await using _screen = await render(<SidebarTree onMenu={onMenu} />);
    focusThread();
    await userEvent.keyboard("m");
    expect(onMenu).toHaveBeenCalledOnce();
  });

  it("collapses the enclosing shelf with x and lands on it", async () => {
    using _vim = useVimMode();
    await using _screen = await render(<SidebarTree />);
    focusThread();
    await userEvent.keyboard("x");
    expect(expandedOf("snoozed")).toBe("false");
    expect(document.activeElement?.getAttribute("data-sidebar-row")).toBe("shelf:snoozed");
  });

  it("expands a collapsed shelf with x", async () => {
    using _vim = useVimMode();
    await using _screen = await render(<SidebarTree />);
    document.querySelector<HTMLElement>('[data-sidebar-row="shelf:settled"]')!.focus();
    await userEvent.keyboard("x");
    expect(expandedOf("settled")).toBe("true");
  });

  it("collapses everything with X, then expands it all again", async () => {
    using _vim = useVimMode();
    await using _screen = await render(<SidebarTree />);
    focusThread();
    await userEvent.keyboard("X");
    expect([expandedOf("snoozed"), expandedOf("settled")]).toEqual(["false", "false"]);
    await userEvent.keyboard("X");
    expect([expandedOf("snoozed"), expandedOf("settled")]).toEqual(["true", "true"]);
  });

  it("opens the filter with F and returns to the list once it hands focus back", async () => {
    using _vim = useVimMode();
    focusRequests.mockClear();
    const onFilter = vi.fn();
    await using _screen = await render(<SidebarTree onFilter={onFilter} />);
    focusThread();
    await userEvent.keyboard("F");
    expect(onFilter).toHaveBeenCalledOnce();
    document.querySelector<HTMLElement>('[aria-label="Filter threads by project"]')!.focus();
    expect(focusRequests).toHaveBeenCalledWith(expect.objectContaining({ area: "sidebar" }));
  });

  it("moves from a header button to the list with j, instead of opening it", async () => {
    using _vim = useVimMode();
    focusRequests.mockClear();
    const onFilter = vi.fn();
    await using _screen = await render(<SidebarTree onFilter={onFilter} />);
    document.querySelector<HTMLElement>('[aria-label="Filter threads by project"]')!.focus();
    await userEvent.keyboard("j");
    expect(onFilter).not.toHaveBeenCalled();
    expect(focusRequests).toHaveBeenCalledWith(expect.objectContaining({ area: "sidebar" }));
  });

  it("opens or closes Snoozed and Settled together with I", async () => {
    using _vim = useVimMode();
    await using _screen = await render(<SidebarTree />);
    focusThread();
    await userEvent.keyboard("I");
    expect([expandedOf("snoozed"), expandedOf("settled")]).toEqual(["false", "false"]);
    await userEvent.keyboard("I");
    expect([expandedOf("snoozed"), expandedOf("settled")]).toEqual(["true", "true"]);
  });
});
