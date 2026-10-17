// Thin re-exports: the pure helpers for the math components live in @aei/viz (libs/utils/viz).
// Kept so existing imports of "./mathHelpers.ts" keep working.

export {
  ALPHA,
  addDaysIso,
  betaDensity,
  betaGrid as betaCurve,
  formatNum,
  formatP,
  formatPSup,
  logGamma,
  type PoissonPlan,
  poissonPlan,
  poissonPmf,
  poissonTailMass as tailSum,
  surprise,
  type TailKind,
  weeklyPatients,
} from "@aei/viz";
