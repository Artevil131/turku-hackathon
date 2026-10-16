// Prints the TypeScript gears' statistics for a fixed grid of inputs as JSON,
// for check.py to compare with scipy and statsmodels. Run by check.py.
import { wilson } from "../../libs/utils/coverage/src/index.ts";
import { cochranArmitageRising, normalUpper, poissonLower, poissonUpper } from "../../libs/utils/detect/src/index.ts";

const grid = JSON.parse(process.argv[2] ?? "{}");
const out = {
  poissonUpper: grid.poisson.map(([k, m]: [number, number]) => poissonUpper(k, m)),
  poissonLower: grid.poisson.map(([k, m]: [number, number]) => poissonLower(k, m)),
  normal: grid.normal.map((z: number) => normalUpper(z)),
  trend: grid.trend.map((g: { events: number; n: number }[]) => cochranArmitageRising(g)),
  wilson: grid.wilson.map(([k, n]: [number, number]) => wilson(k, n)),
};
console.log(JSON.stringify(out));
