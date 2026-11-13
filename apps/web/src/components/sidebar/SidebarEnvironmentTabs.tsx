import type { EnvironmentId } from "@t3tools/contracts";

import { cn } from "~/lib/utils";

interface EnvironmentTab {
  readonly environmentId: EnvironmentId;
  readonly label: string;
}

/** The environment list arrives in no fixed order, so Local leads and the rest sort by name. */
export function sortEnvironmentTabs<T extends EnvironmentTab>(
  environments: ReadonlyArray<T>,
  primaryEnvironmentId: EnvironmentId | null,
): T[] {
  return environments.toSorted(
    (a, b) =>
      Number(b.environmentId === primaryEnvironmentId) -
        Number(a.environmentId === primaryEnvironmentId) ||
      a.label.localeCompare(b.label) ||
      a.environmentId.localeCompare(b.environmentId),
  );
}

/** One tab per environment, so local and remote threads never share a list. */
export function SidebarEnvironmentTabs(props: {
  readonly environments: ReadonlyArray<EnvironmentTab>;
  readonly primaryEnvironmentId: EnvironmentId | null;
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly onChange: (environmentId: EnvironmentId) => void;
}) {
  const environments = sortEnvironmentTabs(props.environments, props.primaryEnvironmentId);
  return (
    <div role="tablist" aria-label="Environments" className="mb-1 flex gap-1">
      {environments.map(({ environmentId, label }) => {
        const selected = environmentId === props.selectedEnvironmentId;
        return (
          <button
            key={environmentId}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "h-7 min-w-0 flex-1 truncate rounded-md px-2 text-xs font-medium text-sidebar-muted-foreground hover:bg-sidebar-row-hover hover:text-sidebar-foreground",
              selected && "bg-sidebar-row-hover text-sidebar-foreground",
            )}
            onClick={() => props.onChange(environmentId)}
          >
            {environmentId === props.primaryEnvironmentId ? "Local" : label}
          </button>
        );
      })}
    </div>
  );
}
