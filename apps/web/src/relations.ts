import type { Flow } from "@aei/relations";
import { createContext, useContext } from "react";

// Patient flow between units (D-011), computed by the server from the data
// up to the replay clock (D-013) and shared with every view that draws it.

export { nextUnits, previousUnits, undirectedFlows } from "@aei/relations";

export const FlowsContext = createContext<readonly Flow[]>([]);

export function useFlows(): readonly Flow[] {
  return useContext(FlowsContext);
}
