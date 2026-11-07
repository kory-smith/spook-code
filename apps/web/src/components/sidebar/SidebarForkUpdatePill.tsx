import { CircleArrowUpIcon } from "lucide-react";

import { startForkUpdate, useForkUpdate } from "../../forkUpdate";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

/** Offers to merge, rebuild, and reinstall when upstream ships a release this fork lacks. */
export function SidebarForkUpdatePill() {
  const release = useForkUpdate();
  if (!release) return null;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={startForkUpdate}>
        <CircleArrowUpIcon />
        <span>Update fork to {release}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
