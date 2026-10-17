import { PAGE_VERSION, type Page, savePage } from "../components/research/notebook/model.ts";
import { PAGE_EVENT } from "../components/research/notebook/usePage.ts";
import type { FillPlan } from "./openDemo.ts";

/** The notebook as the demo plans it, in one step: handed to the open page and saved, so nothing is left half done. */
export function applyPlan(plan: FillPlan): void {
  const page: Page = { v: PAGE_VERSION, cells: plan.cells };
  dispatchEvent(new CustomEvent(PAGE_EVENT, { detail: { slot: plan.slot, page } }));
  savePage(plan.slot, page);
}
