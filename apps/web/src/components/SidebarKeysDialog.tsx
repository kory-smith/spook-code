import { useSidebarKeyState } from "../lib/sidebarKeyState";
import { SIDEBAR_KEYS } from "../vim-sidebar";
import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "./ui/dialog";
import { Kbd, KbdGroup } from "./ui/kbd";

export function SidebarKeysDialog() {
  const open = useSidebarKeyState((state) => state.helpOpen);
  return (
    <Dialog open={open} onOpenChange={(helpOpen) => useSidebarKeyState.setState({ helpOpen })}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Sidebar keys</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
            {SIDEBAR_KEYS.map(({ keys, label }) => (
              <div key={label} className="contents">
                <dt>
                  <KbdGroup>
                    {keys.map((key) => (
                      // Shown with ⇧ so capitals like I don't read as l.
                      <Kbd key={key}>{/^[A-Z]$/.test(key) ? `⇧${key}` : key}</Kbd>
                    ))}
                  </KbdGroup>
                </dt>
                <dd className="text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
