import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import appCss from "~/index.css?inline";
import forkCss from "~/fork.css?inline";

function setup() {
  const style = document.createElement("style");
  style.textContent = appCss + forkCss;
  document.head.append(style);
  const root = document.createElement("div");
  root.innerHTML = `
    <main data-workspace-area="home" tabindex="-1" style="height: 100px"></main>
    <section data-workspace-area="composer">
      <div data-chat-composer-surface><textarea></textarea></div>
    </section>`;
  document.body.append(root);
  const query = (selector: string) => root.querySelector<HTMLElement>(selector)!;
  return {
    home: query('[data-workspace-area="home"]'),
    composer: query('[data-workspace-area="composer"]'),
    surface: query("[data-chat-composer-surface]"),
    input: query("textarea"),
    [Symbol.dispose]: () => {
      root.remove();
      style.remove();
    },
  };
}

const outline = (element: HTMLElement) => getComputedStyle(element).outlineStyle;

describe("fork focus outline", () => {
  it("outlines a clicked area, even after a bare key press", async () => {
    using fixture = setup();
    await userEvent.click(fixture.home);
    expect(outline(fixture.home)).toBe("solid");
    await userEvent.keyboard("{Shift}");
    expect(outline(fixture.home)).toBe("solid");
  });

  it("outlines the composer's input box instead of its overlay area", async () => {
    using fixture = setup();
    await userEvent.click(fixture.input);
    expect(outline(fixture.composer)).toBe("none");
    expect(outline(fixture.surface)).toBe("solid");
  });
});
