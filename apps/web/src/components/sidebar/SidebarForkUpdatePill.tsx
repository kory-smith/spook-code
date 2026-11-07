import { CircleArrowUpIcon } from "lucide-react";

import { startForkUpdate, useForkUpdate } from "../../forkUpdate";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

/** Offers to merge, rebuild, and reinstall when upstream ships a release this fork lacks. */
export function SidebarForkUpdatePill() {
  const release = useForkUpdate();
  if (!release) return null;
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={startForkUpdate}>
          <CircleArrowUpIcon />
          <span className="truncate">Update fork to {release}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
