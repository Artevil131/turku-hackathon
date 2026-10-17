// Copy for the guided tours, assembled from one file per tour so each can be written on its own.

import { tourClinEn, tourClinFi } from "./tourClin.ts";
import { tourCtrlEn, tourCtrlFi } from "./tourCtrl.ts";
import { tourOvEn, tourOvFi } from "./tourOv.ts";
import { tourResEn, tourResFi } from "./tourRes.ts";
import { tourSharedEn, tourSharedFi } from "./tourShared.ts";

export const tourEn = { ...tourSharedEn, ...tourClinEn, ...tourCtrlEn, ...tourResEn, ...tourOvEn };
export const tourFi: Record<keyof typeof tourEn, string> = { ...tourSharedFi, ...tourClinFi, ...tourCtrlFi, ...tourResFi, ...tourOvFi };
