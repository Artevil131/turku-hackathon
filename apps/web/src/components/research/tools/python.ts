import { LIVE_SETTINGS } from "@aei/detect";
import { type CellResult, eventKey, type Frame, frameDays, type Slice } from "./model.ts";

// "Copy as Python" gives a script a researcher can read and run: it loads the same slice from the AEI
// server (or the research package), repeats the arithmetic step by step in plain Python, prints each
// number with the value the cell showed, and ends with the aei call that runs the same code in the app.
// Nothing here changes a method; the formulas are those of @aei/compare and @aei/coverage (D-074).

const q = (v: string) => JSON.stringify(v);
const n3 = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? "nan" : Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(4)));
const pct = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "nan" : `${(100 * v).toFixed(1)} %`);

/** The keyword arguments of `api.isolates(...)` for a frame and the slice's other filters. */
function query(f: Frame, s: Slice, wide = false): string {
  const parts = [`"from": ${q(f.from)}`, `"to": ${q(f.to)}`];
  if (f.unit && !wide) parts.push(`"ward": ${q(f.unit)}`);
  if (s.organism && !wide) parts.push(`"organism": ${q(s.organism)}`);
  if (s.specimen && !wide) parts.push(`"specimen": ${q(s.specimen)}`);
  return `{${parts.join(", ")}}`;
}

function frameWords(f: Frame): string {
  return `${f.unit || "all units"} · ${f.from} – ${f.to}`;
}

function sliceWords(s: Slice): string {
  const bits = [s.unit || "all units", s.organism, s.specimen, s.phenotype].filter(Boolean);
  return `${bits.join(" · ")} · ${s.from} – ${s.to} · ${s.firstOnly ? "first isolates" : "all isolates"}`;
}

/** Lines that load one frame into `name`, as the tool did: the API rows, then first isolates when the slice says so. */
function load(name: string, f: Frame, s: Slice, wide = false): string[] {
  const out = [`${name} = api.isolates(**${query(f, s, wide)})`];
  if (s.firstOnly) {
    out.push(
      `${name} = ${name}.sort_values(["sampleDate", "isolateId"]).drop_duplicates(["patientId", "organism", "specimen"])  # first isolate per patient, organism and specimen in the frame`,
    );
  }
  return out;
}

function head(title: string, s: Slice, asOf: string | null, origin: string): string[] {
  return [
    `# AEI · ${title}`,
    `# Slice: ${sliceWords(s)}${asOf ? ` · as of ${asOf}` : ""}`,
    "# Every number in a comment is what the cell showed; running this against the same data prints the same.",
    "import math",
    "import aei",
    `api = aei.connect(${q(origin)})  # or: pkg = aei.read_package("aei-package.zip"); rows = pkg.table("isolates")`,
    "",
  ];
}

const WILSON = [
  "def wilson(k, n, z=1.959964):",
  '    """Wilson score 95 % interval of k / n (same arithmetic as aei.coverage.wilson)."""',
  "    if n == 0:",
  "        return (0.0, 1.0)",
  "    p = k / n",
  "    d = 1 + z * z / n",
  "    centre = (p + z * z / (2 * n)) / d",
  "    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d",
  "    return (max(0.0, centre - half), min(1.0, centre + half))",
];

const POISSON = [
  "from scipy.stats import chi2",
  "def poisson_interval(k):",
  '    """Exact (Garwood) 95 % interval of a Poisson mean given the count k."""',
  "    lo = 0.0 if k == 0 else chi2.ppf(0.025, 2 * k) / 2",
  "    hi = chi2.ppf(0.975, 2 * (k + 1)) / 2",
  "    return (lo, hi)",
];

const EVENT_FILTER = (event: ReturnType<typeof eventKey>) => {
  const [type, code] = event.split(":");
  return type === "phenotype"
    ? [
        `is_event = rows["phenotype_list"].apply(lambda p: ${q(code ?? "")} in p)  # the event: the ${code} phenotype`,
        "tested = rows  # every isolate is tested for a phenotype",
      ]
    : [
        `tested = rows[rows[${q(code ?? "")}].notna()]  # isolates tested against ${code}`,
        `is_event = tested[${q(code ?? "")}] == "R"  # the event: resistant to ${code}`,
      ];
};

export function pythonScript(r: CellResult, ctx: { asOf: string | null; origin: string }): string {
  const s = r.slice;
  const lines: string[] = [];
  switch (r.kind) {
    case "rate": {
      lines.push(...head("Rate in a frame", s, ctx.asOf, ctx.origin), ...load("rows", s, s), "");
      if (s.phenotype) {
        lines.push(
          `counted = rows[rows["phenotype_list"].apply(lambda p: ${q(s.phenotype)} in p)]  # isolates with the ${s.phenotype} phenotype`,
        );
      } else lines.push("counted = rows  # every isolate in the slice");
      lines.push(
        `k = len(counted)  # ${r.count}`,
        `days = ${r.days}  # inclusive, ${s.from} to ${s.to}`,
        "weeks = days / 7",
        "",
        ...POISSON,
        "lo, hi = poisson_interval(k)",
        `print("isolates", k, lo, hi)  # ${r.count} ${n3(r.perWeekInterval.lo * r.weeks)} ${n3(r.perWeekInterval.hi * r.weeks)}`,
        `print("per week", k / weeks, lo / weeks, hi / weeks)  # ${n3(r.perWeek)} ${n3(r.perWeekInterval.lo)} ${n3(r.perWeekInterval.hi)}`,
        "",
        `cultures = rows["cultureId"].nunique()  # ${r.cultures}; one culture can grow several organisms, so this can be below k`,
        `print("isolates per 100 cultures", 100 * k / cultures)  # ${n3(r.per100Cultures)}`,
      );
      if (r.share) {
        lines.push(
          "",
          ...WILSON,
          `n = len(rows)  # ${r.share.n} isolates in the slice`,
          `print("share", k / n, *wilson(k, n))  # ${pct(r.share.share)} ${pct(r.share.interval.lo)} ${pct(r.share.interval.hi)}`,
          `assert wilson(k, n) == aei.coverage.wilson(k, n)  # the app's own function`,
        );
      }
      return lines.join("\n");
    }
    case "compare": {
      const ev = eventKey(r.event);
      lines.push(
        ...head("Compare two frames", s, ctx.asOf, ctx.origin),
        `# Frame A: ${frameWords(r.a.frame)} · Frame B: ${frameWords(r.b.frame)} · event: ${ev}`,
        "",
        "def counts(rows):",
        ...EVENT_FILTER(ev).map((l) => `    ${l}`),
        "    return int(is_event.sum()), len(tested)",
        "",
        ...load("rows_a", r.a.frame, s),
        ...load("rows_b", r.b.frame, s),
        `kA, nA = counts(rows_a)  # ${r.a.k}, ${r.a.n}`,
        `kB, nB = counts(rows_b)  # ${r.b.k}, ${r.b.n}`,
        "",
        ...WILSON,
        "pA, pB = kA / nA, kB / nB",
        "lA, uA = wilson(kA, nA)",
        "lB, uB = wilson(kB, nB)",
        "# Newcombe's hybrid score interval of the difference pA - pB (the cell reads A against B)",
        "diff = pA - pB",
        "lo = diff - math.sqrt((pA - lA) ** 2 + (uB - pB) ** 2)",
        "hi = diff + math.sqrt((uA - pA) ** 2 + (pB - lB) ** 2)",
        `print("difference", diff, lo, hi)  # ${pct(r.difference?.diff)} ${pct(r.difference?.interval.lo)} ${pct(r.difference?.interval.hi)}`,
        "# pooled two-sided z test",
        "pooled = (kA + kB) / (nA + nB)",
        "se = math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB))",
        "from scipy.stats import norm",
        "z = diff / se if se > 0 else 0.0",
        `print("p", 2 * norm.sf(abs(z)))  # ${n3(r.difference?.p)}`,
        "",
        "# Events per week, A ÷ B: exact conditional test (given kA + kB, kA is Binomial with p = tA / (tA + tB))",
        `tA, tB = ${n3(r.a.weeks)}, ${n3(r.b.weeks)}  # weeks`,
        "ratio = (kA / tA) / (kB / tB) if kB > 0 else math.inf",
        `print("rate ratio", ratio)  # ${n3(r.ratio?.ratio)}; 95 % interval ${n3(r.ratio?.interval.lo)}–${n3(r.ratio?.interval.hi)} from aei.compare.rate_ratio`,
        "",
        "# The app's own functions (they report B against A, so the sign and the ratio are turned around):",
        "d = aei.compare.proportion_difference(kA, nA, kB, nB)   # d['diff'] == pB - pA",
        "rr = aei.compare.rate_ratio(kA, tA, kB, tB)              # rr['ratio'] == 1 / ratio",
      );
      if (r.trend) {
        lines.push(
          `# Trend across the ${r.trend.periods} weekly bins of A then B: one-sided Cochran–Armitage`,
          `# p = ${n3(r.trend.p)} from aei.compare.trend_across([(events, n), ...])`,
        );
      }
      return lines.join("\n");
    }
    case "shares": {
      const ev = eventKey(r.event);
      lines.push(
        ...head("Share over time", s, ctx.asOf, ctx.origin),
        ...load("rows", s, s),
        ...EVENT_FILTER(ev),
        "",
        ...WILSON,
        "import pandas as pd",
        `period = pd.Timedelta(days=${r.periodDays})`,
        `start = pd.Timestamp(${q(s.from)})`,
        'bins = ((pd.to_datetime(tested["sampleDate"]) - start) // period).rename("bin")',
        'table = pd.DataFrame({"bin": bins, "event": is_event.values}).groupby("bin")["event"].agg(k="sum", n="size").reset_index()',
        'table["from"] = (start + table["bin"] * period).dt.date',
        'table["share"] = table["k"] / table["n"]',
        'table[["lo", "hi"]] = table.apply(lambda t: pd.Series(wilson(int(t.k), int(t.n))), axis=1)',
        `print(table)  # ${r.points.length} periods; the cell's first: ${r.points[0] ? `${r.points[0].from} k=${r.points[0].k} n=${r.points[0].n} share=${pct(r.points[0].share)}` : "none"}`,
        "",
        `# The app's own function: aei.compare.shares_by_period(records, from_=${q(s.from)}, to=${q(s.to)}, period_days=${r.periodDays}, event=${q(ev)})`,
      );
      return lines.join("\n");
    }
    case "beta": {
      const ev = eventKey(r.event);
      lines.push(
        ...head("Belief about a share (Beta posterior)", s, ctx.asOf, ctx.origin),
        ...load("rows", s, s),
        ...EVENT_FILTER(ev),
        `k, n = int(is_event.sum()), len(tested)  # ${r.k}, ${r.n}`,
        "",
        "# Flat prior Beta(1, 1): posterior Beta(k + 1, n - k + 1)",
        "from scipy.stats import beta",
        "a, b = k + 1, n - k + 1",
        `print("mean", a / (a + b))  # ${pct(r.posterior.mean)}`,
        `print("95 % interval", beta.ppf(0.025, a, b), beta.ppf(0.975, a, b))  # ${pct(r.posterior.interval.lo)} ${pct(r.posterior.interval.hi)}`,
        "# The app's own function: aei.compare.beta_posterior(k, n)",
      );
      if (r.discounted) {
        const d = r.discounted;
        lines.push(
          "",
          `# D-041 discounted belief: weekly (k, n) oldest first, each week weighted delta ** (weeks before the last); prior m × share, m × (1 - share) from the hospital-wide share`,
          `delta, m, parent_share = ${n3(d.delta)}, ${n3(d.m)}, ${n3(d.parentShare)}`,
          "import pandas as pd",
          `weeks = pd.DataFrame({"week": (pd.to_datetime(tested["sampleDate"]) - pd.Timestamp(${q(s.from)})).dt.days // 7, "event": is_event.values}).groupby("week")["event"].agg(k="sum", n="size")`,
          "last = weeks.index.max()",
          "wk = sum(delta ** (last - i) * row.k for i, row in weeks.iterrows())",
          "wn = sum(delta ** (last - i) * row.n for i, row in weeks.iterrows())",
          "a2, b2 = m * parent_share + wk, m * (1 - parent_share) + (wn - wk)",
          `print("discounted mean", a2 / (a2 + b2), "effective n", wn)  # ${pct(d.posterior.mean)} ${n3(d.posterior.effectiveN)}`,
          `# The app's own function: aei.compare.discounted_beta([(k, n), ...], delta=${n3(d.delta)}, m=${n3(d.m)}, parent_share=${n3(d.parentShare)})`,
        );
      }
      return lines.join("\n");
    }
    case "detector": {
      const live = r.detector === "profile" ? LIVE_SETTINGS.profileExcess : LIVE_SETTINGS.phenotypeExcess;
      const baseFrom = new Date(Date.UTC(+s.from.slice(0, 4), +s.from.slice(5, 7) - 1, +s.from.slice(8, 10) - 365))
        .toISOString()
        .slice(0, 10);
      lines.push(
        ...head(`Detector here (${r.detector === "profile" ? "profile excess" : "phenotype excess"})`, s, ctx.asOf, ctx.origin),
        "# The live detector on this frame, with its own baseline: every unit and organism, 365 days before the frame.",
        `rows = api.isolates(**{"from": ${q(baseFrom)}, "to": ${q(s.to)}})  # ${r.fetched} isolates`,
        "records = aei.dataset.records_from_frame(rows)  # the record objects the detector reads",
        "",
        `# For each unit and ${r.detector === "profile" ? "resistance profile" : "phenotype"}, in a ${live.windowDays}-day window ending on each day:`,
        "#   y  = distinct patients with it in the window",
        r.detector === "profile"
          ? `#   mu = patients in the unit (window) × (B_profile + 1/2) / (B_all + 1), B over the hospital in the ${live.baselineDays} days before`
          : `#   mu = patients in the unit (window) × (B_unit + 1/2) / (B + 1), B over this unit in the ${live.baselineDays} days before`,
        `#   signal when y ≥ ${live.minObserved} and P(Y ≥ y | Poisson(mu)) < ${live.alpha}`,
        "from scipy.stats import poisson",
        "def tail(y, mu):",
        "    return poisson.sf(y - 1, mu)  # P(Y >= y)",
        "",
        r.detector === "profile"
          ? `signals = aei.detect.profile_excess(records, window_days=${live.windowDays}, baseline_days=${live.baselineDays}, alpha=${live.alpha}, min_observed=${live.minObserved}, same_specimen=True)`
          : `signals = aei.detect.phenotype_excess(records, phenotypes=[${r.phenotypes.map(q).join(", ")}], window_days=${live.windowDays}, baseline_days=${live.baselineDays}, alpha=${live.alpha}, min_observed=${live.minObserved})`,
        `in_frame = [x for x in signals if ${q(s.from)} <= x.date <= ${q(s.to)}${s.unit ? ` and x.ward == ${q(s.unit)}` : ""}]`,
        `print(len(in_frame))  # ${r.rows.reduce((a, e) => a + e.signals, 0)} signals in ${r.rows.length} episodes`,
        ...r.rows
          .slice(0, 5)
          .map((e) => `# ${e.unit ?? "hospital"} · ${e.label} · ${e.first}–${e.last} · y=${e.observed} mu=${n3(e.expected)} p=${n3(e.p)}`),
        "for x in in_frame:",
        "    assert abs(tail(x.observed, x.expected) - x.p) < 1e-9  # the tail above, recomputed",
      );
      return lines.join("\n");
    }
  }
}

/** The script's filename when saved. */
export function pythonFileName(r: CellResult, asOf: string | null): string {
  return `aei-${r.kind}-${r.slice.from}-${r.slice.to}${asOf ? `-asof-${asOf}` : ""}.py`;
}

export const frameDaysOf = frameDays;
