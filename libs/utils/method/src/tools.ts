import { METHODS, type Method } from "./registry.ts";

// The research tools' methods (D-074, D-076), the same shape as the detectors' entries so the notebook's
// method block reads one source: the test's name, the formula as LaTeX and MathML, constants with their
// decisions, where it runs, and a Python and an R snippet. Formulas are the ones the code implements
// (@aei/compare, @aei/coverage, the Tools model); no statistic here is new. The app's Tools model keeps
// the constants it owns (the Poisson tail, the trend's periods); notebook.test checks them against these.
//
// Snippet placeholders are the formula's letters, {k}, {n}, {T} and so on, filled by `fillTemplate`.

export type ToolMethodId =
  | "tool-rate"
  | "tool-compare"
  | "tool-shares"
  | "tool-beta"
  | "tool-beta-discounted"
  | "tool-detector-phenotype"
  | "tool-detector-profile";

export interface ToolMethod extends Omit<Method, "id"> {
  id: ToolMethodId;
  /** The same computation in R (base R where it has the statistic; a comment where it has none). */
  r: string;
}

// ---------- MathML, built from small pieces so the strings stay readable ----------

const mi = (v: string) => `<mi>${v}</mi>`;
const mn = (v: string | number) => `<mn>${v}</mn>`;
const mo = (v: string) => `<mo>${v}</mo>`;
const mt = (v: string) => `<mtext>${v}</mtext>`;
const row = (...xs: string[]) => `<mrow>${xs.join("")}</mrow>`;
const frac = (a: string, b: string) => `<mfrac>${a}${b}</mfrac>`;
const sub = (a: string, b: string) => `<msub>${a}${b}</msub>`;
const sup = (a: string, b: string) => `<msup>${a}${b}</msup>`;
const sqrt = (a: string) => `<msqrt>${a}</msqrt>`;
const hat = (a: string) => `<mover accent="true">${a}<mo>^</mo></mover>`;
const gap = '<mspace width="1em"/>';
const math = (...xs: string[]) => `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${row(...xs)}</math>`;
const paren = (...xs: string[]) => row(mo("("), ...xs, mo(")"));
const p = (s: string) => sub(hat(mi("p")), mi(s));

/** The Wilson score interval of a share `ph` of `n`, as @aei/coverage `wilson` computes it (MathML pieces in). */
const wilsonMl = (ph: string, n: string) =>
  frac(
    row(
      ph,
      mo("+"),
      frac(sup(mi("z"), mn(2)), row(mn(2), n)),
      mo("±"),
      mi("z"),
      sqrt(row(frac(row(ph, paren(mn(1), mo("−"), ph)), n), mo("+"), frac(sup(mi("z"), mn(2)), row(mn(4), sup(n, mn(2)))))),
    ),
    row(mn(1), mo("+"), frac(sup(mi("z"), mn(2)), n)),
  );
/** The same in LaTeX; `n` is wrapped in braces so a subscripted n stays one group. */
const wilsonTex = (ph: string, n: string) =>
  `\\frac{${ph}+\\frac{z^2}{2{${n}}}\\pm z\\sqrt{\\frac{${ph}(1-${ph})}{${n}}+\\frac{z^2}{4{${n}}^2}}}{1+\\frac{z^2}{${n}}}`;

/** z of `wilson` in @aei/coverage (its default) and of `proportionDifference` in @aei/compare. */
const Z_WILSON = 1.959964;
const Z_COMPARE = 1.96;

// ---------- Python that shows the working ----------
// Each Python snippet is a script a researcher can run with the standard library alone: the formula step by step,
// with this result's numbers, then the aei call that gives the same numbers (the parity-tested mirror, D-061).

const PY_WILSON = [
  "def wilson(k, n, z):  # Wilson score interval of k of n",
  "    p = k / n",
  "    d = 1 + z * z / n",
  "    centre = (p + z * z / (2 * n)) / d",
  "    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d",
  "    return max(0.0, centre - half), min(1.0, centre + half)",
];

const PY_BETA_INTERVAL = [
  "def beta_interval(a, b, cells=4000):  # central 95 % of Beta(a, b), read from a 4000-cell grid as the gear does",
  "    logs = [(a - 1) * math.log((i + 0.5) / cells) + (b - 1) * math.log(1 - (i + 0.5) / cells) for i in range(cells)]",
  "    top = max(logs)",
  "    mass = [math.exp(v - top) for v in logs]",
  "    total = sum(mass)",
  "    def quantile(q):",
  "        cum = 0.0",
  "        for i, m in enumerate(mass):",
  "            if cum + m >= q * total:",
  "                return (i + (q * total - cum) / m) / cells",
  "            cum += m",
  "        return 1.0",
  "    return quantile(0.025), quantile(0.975)",
];

const DETECTOR_R = (fn: string) =>
  [
    `# The live detector runs in TypeScript (@aei/detect) and Python (aei.detect.${fn}); the R package`,
    "# (libs/utils/r) has no port of it yet. Read its signals from the research package instead:",
    "library(aei)",
    'pkg <- read_package(".")',
    "reproduce(pkg)",
  ].join("\n");

export const TOOL_METHODS: Record<ToolMethodId, ToolMethod> = {
  "tool-rate": {
    id: "tool-rate",
    name: {
      en: "Poisson rate with exact interval; share with Wilson interval",
      fi: "Poisson-tiheys tarkalla välillä; osuus Wilsonin välillä",
    },
    latex: `\\hat\\lambda=\\frac{k}{T},\\ \\left[\\frac{\\mu_L}{T},\\frac{\\mu_U}{T}\\right]:\\ P(Y\\ge k\\mid\\mu_L)=P(Y\\le k\\mid\\mu_U)=0.025,\\ Y\\sim\\mathrm{Poisson}(\\mu);\\quad \\hat p=\\frac{k}{n},\\ ${wilsonTex("\\hat p", "n")}`,
    mathml: math(
      hat(mi("λ")),
      mo("="),
      frac(mi("k"), mi("T")),
      mo(","),
      gap,
      mi("P"),
      paren(mi("Y"), mo("≥"), mi("k"), mo("∣"), sub(mi("μ"), mi("L"))),
      mo("="),
      mi("P"),
      paren(mi("Y"), mo("≤"), mi("k"), mo("∣"), sub(mi("μ"), mi("U"))),
      mo("="),
      mn("0.025"),
      mo(";"),
      gap,
      hat(mi("p")),
      mo("="),
      frac(mi("k"), mi("n")),
      mo(","),
      gap,
      wilsonMl(hat(mi("p")), mi("n")),
    ),
    plain: {
      en: "Events in the slice per week, with the exact (Garwood) 95 % Poisson interval of the count divided by the weeks; with a phenotype, its share of the slice's isolates with the Wilson 95 % interval.",
      fi: "Tapahtumat viikkoa kohden rajauksessa, laskennan tarkka (Garwood) 95 % Poisson-väli jaettuna viikoilla; fenotyypille sen osuus rajauksen isolaateista Wilsonin 95 % välillä.",
    },
    constants: [
      { name: "tail per side", value: 0.025, decision: "D-076" },
      { name: "z (Wilson)", value: Z_WILSON, decision: "D-076" },
      { name: "first isolates", value: "per patient, organism, specimen", decision: "D-076" },
    ],
    code: { ts: "apps/web/src/components/research/tools/model.ts", fn: "computeRate", py: "aei.coverage.wilson" },
    decisions: ["D-076"],
    snippet: [
      "# Rate in a frame: events per week with the exact (Garwood) 95 % Poisson interval; with a phenotype, its share with Wilson's.",
      "import math",
      "",
      "k = {k}  # events counted in the slice",
      "T = {T}  # weeks in the frame",
      "n = {n}  # isolates in the slice (None: no phenotype, so no share)",
      "",
      "def poisson_cdf(x, mu):  # P(Y <= x | Y ~ Poisson(mu)), summed in logs so large counts do not underflow",
      "    if x < 0:",
      "        return 0.0",
      "    return min(1.0, math.fsum(math.exp(-mu + i * math.log(mu) - math.lgamma(i + 1)) for i in range(x + 1)))",
      "",
      "def solve(f, target, lo, hi):  # the mu where the increasing f(mu) reaches target, by bisection",
      "    for _ in range(80):",
      "        mid = (lo + hi) / 2",
      "        lo, hi = (mid, hi) if f(mid) < target else (lo, mid)",
      "    return (lo + hi) / 2",
      "",
      "top = k + 10 * math.sqrt(k + 1) + 20",
      "mu_lo = 0.0 if k == 0 else solve(lambda m: 1 - poisson_cdf(k - 1, m), 0.025, 1e-9, k)  # P(Y >= k | mu_lo) = 0.025",
      "mu_hi = solve(lambda m: 1 - poisson_cdf(k, m), 0.975, max(k, 1e-9), top)                # P(Y <= k | mu_hi) = 0.025",
      'print(f"events {k}, 95 % {mu_lo:.1f} to {mu_hi:.1f}")',
      'print(f"per week {k / T:.2f}, 95 % {mu_lo / T:.2f} to {mu_hi / T:.2f}")',
      "",
      ...PY_WILSON,
      "",
      "if n:",
      "    lo, hi = wilson(k, n, z=1.959964)",
      '    print(f"share {k / n:.3f}, 95 % {lo:.3f} to {hi:.3f}")',
      "",
      "# The same with the aei package: aei.coverage.wilson(k, n) for the share.",
    ].join("\n"),
    r: [
      "k <- {k}; T <- {T}; n <- {n}  # events, weeks, isolates (NA: no phenotype, so no share)",
      "poisson.test(k, T = T)$conf.int  # events per week, exact (Garwood) 95 %",
      "if (!is.na(n)) prop.test(k, n, correct = FALSE)$conf.int  # share, Wilson 95 %",
    ].join("\n"),
  },
  "tool-compare": {
    id: "tool-compare",
    name: {
      en: "Newcombe difference of two shares; exact conditional rate ratio",
      fi: "Kahden osuuden Newcomben erotus; tarkka ehdollinen tiheyksien suhde",
    },
    latex:
      "\\Delta=\\hat p_A-\\hat p_B,\\ \\left[\\Delta-\\sqrt{(\\hat p_A-l_A)^2+(u_B-\\hat p_B)^2},\\ \\Delta+\\sqrt{(u_A-\\hat p_A)^2+(\\hat p_B-l_B)^2}\\right];\\quad \\mathrm{RR}=\\frac{k_A/t_A}{k_B/t_B},\\ k_A\\mid k_A+k_B\\sim\\mathrm{Bin}\\!\\left(k_A+k_B,\\frac{t_A}{t_A+t_B}\\right)",
    mathml: math(
      mi("Δ"),
      mo("="),
      p("A"),
      mo("−"),
      p("B"),
      mo(","),
      gap,
      mi("Δ"),
      mo("∓"),
      sqrt(
        row(sup(paren(p("A"), mo("−"), sub(mi("l"), mi("A"))), mn(2)), mo("+"), sup(paren(sub(mi("u"), mi("B")), mo("−"), p("B")), mn(2))),
      ),
      mo(";"),
      gap,
      mi("RR"),
      mo("="),
      frac(row(sub(mi("k"), mi("A")), mo("/"), sub(mi("t"), mi("A"))), row(sub(mi("k"), mi("B")), mo("/"), sub(mi("t"), mi("B")))),
      mo(","),
      gap,
      sub(mi("k"), mi("A")),
      mo("∣"),
      sub(mi("k"), mi("A")),
      mo("+"),
      sub(mi("k"), mi("B")),
      mo("∼"),
      mi("Bin"),
      paren(
        sub(mi("k"), mi("A")),
        mo("+"),
        sub(mi("k"), mi("B")),
        mo(","),
        frac(sub(mi("t"), mi("A")), row(sub(mi("t"), mi("A")), mo("+"), sub(mi("t"), mi("B")))),
      ),
    ),
    plain: {
      en: "The share in frame A minus frame B with Newcombe's interval from the two Wilson limits (l, u) and the pooled z-test; the ratio of weekly counts with the exact conditional (binomial) interval and p; with 3 weekly periods in each frame, the one-sided Cochran–Armitage trend.",
      fi: "Osuus jaksossa A miinus jakso B Newcomben välillä kahden Wilson-rajan (l, u) avulla ja yhdistetty z-testi; viikkomäärien suhde tarkalla ehdollisella (binomi) välillä ja p:llä; kun kummassakin jaksossa on 3 viikkoa, yksisuuntainen Cochran–Armitage-trendi.",
    },
    constants: [
      { name: "z (Wilson limits)", value: Z_COMPARE, decision: "D-074" },
      { name: "tail per side (Clopper–Pearson)", value: 0.025, decision: "D-074" },
      { name: "p tolerance", value: 1e-7, decision: "D-074" },
      { name: "trend period days", value: 7, decision: "D-076" },
      { name: "min periods per frame", value: 3, decision: "D-076" },
    ],
    code: { ts: "libs/utils/compare/src/index.ts", fn: "proportionDifference", py: "aei.compare.proportion_difference" },
    decisions: ["D-074", "D-076"],
    snippet: [
      "# Compare two frames: the difference of shares with Newcombe's interval and the pooled z-test; the rate ratio A / B, exact conditional.",
      "import math",
      "",
      "kA, nA, tA = {kA}, {nA}, {tA}  # frame A: events, isolates tested, weeks",
      "kB, nB, tB = {kB}, {nB}, {tB}  # frame B",
      "",
      ...PY_WILSON,
      "",
      "pA, pB = kA / nA, kB / nB",
      "lA, uA = wilson(kA, nA, z=1.96)",
      "lB, uB = wilson(kB, nB, z=1.96)",
      "d = pA - pB",
      "lo = d - math.sqrt((pA - lA) ** 2 + (uB - pB) ** 2)  # Newcombe (hybrid score) interval from the Wilson limits",
      "hi = d + math.sqrt((uA - pA) ** 2 + (pB - lB) ** 2)",
      "pooled = (kA + kB) / (nA + nB)",
      "se = math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB))",
      "p_diff = math.erfc(abs(d / se) / math.sqrt(2)) if se > 0 else 1.0  # two-sided normal test",
      'print(f"share A {pA:.3f}, B {pB:.3f}; A - B {d:+.3f}, 95 % {lo:+.3f} to {hi:+.3f}, p {p_diff:.3g}")',
      "",
      "# Equal rates: given N = kA + kB events, kA ~ Binomial(N, tA / (tA + tB)). The interval is Clopper–Pearson on kA of N.",
      "N = kA + kB",
      "def pmf(i, q):",
      "    if q <= 0 or q >= 1:",
      "        return float(i == (0 if q <= 0 else N))",
      "    return math.exp(math.lgamma(N + 1) - math.lgamma(i + 1) - math.lgamma(N - i + 1) + i * math.log(q) + (N - i) * math.log(1 - q))",
      "def tail(lo_i, hi_i, q):",
      "    return min(1.0, math.fsum(pmf(i, q) for i in range(lo_i, hi_i + 1)))",
      "def solve(f, target):  # q in (0, 1) where the increasing f(q) reaches target",
      "    a, b = 0.0, 1.0",
      "    for _ in range(100):",
      "        m = (a + b) / 2",
      "        a, b = (m, b) if f(m) < target else (a, m)",
      "    return (a + b) / 2",
      "if N > 0:",
      "    q_lo = 0.0 if kA == 0 else solve(lambda q: tail(kA, N, q), 0.025)",
      "    q_hi = 1.0 if kA == N else solve(lambda q: 1 - tail(0, kA, q), 0.975)",
      "    to_ratio = lambda q: math.inf if q >= 1 else q / (1 - q) * tB / tA",
      "    ratio = math.inf if kB == 0 else (kA / tA) / (kB / tB)",
      "    pi0 = tA / (tA + tB)",
      "    seen = pmf(kA, pi0)",
      "    p_ratio = min(1.0, math.fsum(m for m in (pmf(i, pi0) for i in range(N + 1)) if m <= seen * (1 + 1e-7)))",
      '    print(f"per week A {kA / tA:.2f}, B {kB / tB:.2f}; A / B {ratio:.3g}, 95 % {to_ratio(q_lo):.3g} to {to_ratio(q_hi):.3g}, p {p_ratio:.3g}")',
      "",
      "# The same with the aei package:",
      "# aei.compare.proportion_difference(k1={kB}, n1={nB}, k2={kA}, n2={nA})  (diff = A - B)",
      "# aei.compare.rate_ratio(k1={kB}, t1={tB}, k2={kA}, t2={tA})              (ratio = A / B)",
      "# The trend across weeks is aei.compare.trend_across(bins), the one-sided Cochran–Armitage; it needs the weekly bins.",
    ].join("\n"),
    r: [
      "kA <- {kA}; nA <- {nA}; tA <- {tA}; kB <- {kB}; nB <- {nB}; tB <- {tB}",
      "w <- function(k, n) prop.test(k, n, correct = FALSE)$conf.int  # Wilson",
      "pA <- kA / nA; pB <- kB / nB; lA <- w(kA, nA); lB <- w(kB, nB)",
      "d <- pA - pB",
      "c(d - sqrt((pA - lA[1])^2 + (lB[2] - pB)^2), d + sqrt((lA[2] - pA)^2 + (pB - lB[1])^2))  # Newcombe",
      "prop.test(c(kA, kB), c(nA, nB), correct = FALSE)$p.value  # pooled z-test",
      "poisson.test(c(kA, kB), c(tA, tB))  # rate ratio A / B, exact conditional",
      "# The one-sided Cochran–Armitage trend is aei.compare.trend_across (Python); base R's prop.trend.test is two-sided.",
    ].join("\n"),
  },
  "tool-shares": {
    id: "tool-shares",
    name: { en: "Share per period with Wilson interval", fi: "Osuus jaksoittain Wilsonin välillä" },
    latex: `\\hat p_i=\\frac{k_i}{n_i},\\ ${wilsonTex("\\hat p_i", "n_i")}`,
    mathml: math(
      sub(hat(mi("p")), mi("i")),
      mo("="),
      frac(sub(mi("k"), mi("i")), sub(mi("n"), mi("i"))),
      mo(","),
      gap,
      wilsonMl(sub(hat(mi("p")), mi("i")), sub(mi("n"), mi("i"))),
    ),
    plain: {
      en: "For each period of d days, the events k among the isolates in the denominator n, with the Wilson 95 % interval; a period with n = 0 has no share.",
      fi: "Jokaiselle d päivän jaksolle tapahtumat k nimittäjän isolaateista n, Wilsonin 95 % välillä; jaksolla, jolla n = 0, ei ole osuutta.",
    },
    constants: [
      { name: "z (Wilson)", value: Z_WILSON, decision: "D-074" },
      { name: "period days", value: "7, 14 or 28", decision: "D-076" },
    ],
    code: { ts: "libs/utils/compare/src/index.ts", fn: "sharesByPeriod", py: "aei.compare.shares_by_period" },
    decisions: ["D-074", "D-076"],
    snippet: [
      "# Share over time: per period of {d} days, events k among the n isolates in the denominator, with Wilson's 95 % interval.",
      "import math",
      "",
      "periods = [{froms}]",
      "k = [{ks}]",
      "n = [{ns}]",
      "",
      ...PY_WILSON,
      "",
      "for start, ki, ni in zip(periods, k, n):",
      "    if ni == 0:",
      '        print(start, "no isolates, no share")',
      "        continue",
      "    lo, hi = wilson(ki, ni, z=1.959964)",
      '    print(f"{start}  {ki}/{ni}  {ki / ni:.3f}  95 % {lo:.3f} to {hi:.3f}")',
      "",
      "# The same with the aei package, from the rows: aei.compare.shares_by_period(records, from_, to, period_days={d}, event=...)",
    ].join("\n"),
    r: [
      "k <- c({ks})",
      "n <- c({ns})",
      "ci <- t(mapply(function(k, n) if (n > 0) prop.test(k, n, correct = FALSE)$conf.int else c(NA, NA), k, n))",
      "data.frame(from = c({froms}), k, n, share = ifelse(n > 0, k / n, NA), lo = ci[, 1], hi = ci[, 2])",
    ].join("\n"),
  },
  "tool-beta": {
    id: "tool-beta",
    name: { en: "Beta posterior, flat prior", fi: "Beta-posteriori, tasainen priori" },
    latex: "p\\mid k,n\\sim\\mathrm{Beta}(k+1,\\ n-k+1),\\quad E[p]=\\frac{k+1}{n+2}",
    mathml: math(
      mi("p"),
      mo("∣"),
      mi("k"),
      mo(","),
      mi("n"),
      mo("∼"),
      mi("Beta"),
      paren(mi("k"), mo("+"), mn(1), mo(","), mi("n"), mo("−"), mi("k"), mo("+"), mn(1)),
      mo(","),
      gap,
      mi("E"),
      row(mo("["), mi("p"), mo("]")),
      mo("="),
      frac(row(mi("k"), mo("+"), mn(1)), row(mi("n"), mo("+"), mn(2))),
    ),
    plain: {
      en: "The belief about the share after k events of n tested, starting from a flat Beta(1, 1); the central 95 % interval of the posterior.",
      fi: "Uskomus osuudesta k tapahtuman jälkeen n testatusta, lähtien tasaisesta Beta(1, 1):stä; posteriorin keskimmäinen 95 % väli.",
    },
    constants: [
      { name: "prior", value: "Beta(1, 1)", decision: "D-074" },
      { name: "interval grid cells", value: 4000, decision: "D-074" },
      { name: "tail per side", value: 0.025, decision: "D-074" },
    ],
    code: { ts: "libs/utils/compare/src/index.ts", fn: "betaPosterior", py: "aei.compare.beta_posterior" },
    decisions: ["D-074", "D-076"],
    snippet: [
      "# Belief about the share: a flat Beta(1, 1) prior updated by k events of n tested gives Beta(k + 1, n - k + 1).",
      "import math",
      "",
      "k, n = {k}, {n}",
      "a, b = k + 1, n - k + 1",
      "",
      ...PY_BETA_INTERVAL,
      "",
      "lo, hi = beta_interval(a, b)",
      'print(f"Beta({a}, {b}): mean {a / (a + b):.3f}, 95 % {lo:.3f} to {hi:.3f}")',
      "",
      "# The same with the aei package: aei.compare.beta_posterior(k={k}, n={n})",
    ].join("\n"),
    r: ["k <- {k}; n <- {n}", "a <- k + 1; b <- n - k + 1", "c(mean = a / (a + b), qbeta(c(0.025, 0.975), a, b))"].join("\n"),
  },
  "tool-beta-discounted": {
    id: "tool-beta-discounted",
    name: { en: "Discounted Beta posterior (D-041)", fi: "Diskontattu Beta-posteriori (D-041)" },
    latex:
      "p\\sim\\mathrm{Beta}\\!\\left(m\\pi+\\sum_{i=1}^{W}\\delta^{W-i}k_i,\\ m(1-\\pi)+\\sum_{i=1}^{W}\\delta^{W-i}(n_i-k_i)\\right),\\quad n_{\\text{eff}}=\\sum_{i=1}^{W}\\delta^{W-i}n_i",
    mathml: math(
      mi("p"),
      mo("∼"),
      mi("Beta"),
      paren(
        mi("m"),
        mi("π"),
        mo("+"),
        mo("∑"),
        sup(mi("δ"), row(mi("W"), mo("−"), mi("i"))),
        sub(mi("k"), mi("i")),
        mo(","),
        mi("m"),
        paren(mn(1), mo("−"), mi("π")),
        mo("+"),
        mo("∑"),
        sup(mi("δ"), row(mi("W"), mo("−"), mi("i"))),
        paren(sub(mi("n"), mi("i")), mo("−"), sub(mi("k"), mi("i"))),
      ),
      mo(","),
      gap,
      sub(mi("n"), mt("eff")),
      mo("="),
      mo("∑"),
      sup(mi("δ"), row(mi("W"), mo("−"), mi("i"))),
      sub(mi("n"), mi("i")),
    ),
    plain: {
      en: "Weekly counts weighted by δ to the power of the weeks before the last, with m pseudo-isolates at the hospital-wide share π of the same frame as the prior; accepted (D-041), not in the live list.",
      fi: "Viikkomäärät painotettuina δ:n potenssilla viikoista ennen viimeistä, priorina m pseudoisolaattia koko sairaalan saman jakson osuudella π; hyväksytty (D-041), ei käytössä live-listassa.",
    },
    constants: [
      { name: "δ default (range 0.9–1)", value: 0.95, decision: "D-076" },
      { name: "m default", value: 30, decision: "D-046" },
      { name: "π", value: "hospital-wide share, same frame", decision: "D-076" },
      { name: "week length days", value: 7, decision: "D-041" },
    ],
    code: { ts: "libs/utils/compare/src/index.ts", fn: "discountedBeta", py: "aei.compare.discounted_beta" },
    decisions: ["D-041", "D-046", "D-074"],
    snippet: [
      "# Discounted belief (D-041): each week's counts weighted by delta ** (weeks before the last), plus m pseudo-isolates",
      "# at the hospital-wide share pi. Here the weighted sums are already added up:",
      "import math",
      "",
      "delta, m, pi, W = {delta}, {m}, {pi}, {W}  # discount per week, prior strength, hospital-wide share, weeks",
      "a = {a}  # m * pi + sum(delta ** (W - i) * k_i)",
      "b = {b}  # m * (1 - pi) + sum(delta ** (W - i) * (n_i - k_i))",
      "",
      ...PY_BETA_INTERVAL,
      "",
      "lo, hi = beta_interval(a, b)",
      'print(f"Beta({a:.2f}, {b:.2f}): mean {a / (a + b):.3f}, 95 % {lo:.3f} to {hi:.3f}")',
      "",
      "# From the weekly counts with the aei package: aei.compare.discounted_beta(weeks, delta={delta}, m={m}, parent_share={pi})",
    ].join("\n"),
    r: [
      "a <- {a}; b <- {b}  # m·π + Σ δ^(W−i) k_i, m(1−π) + Σ δ^(W−i)(n_i − k_i); δ = {delta}, m = {m}, π = {pi}, W = {W}",
      "c(mean = a / (a + b), qbeta(c(0.025, 0.975), a, b))",
    ].join("\n"),
  },
  // The detector tool runs the live detector itself, so its entries are the detectors' own, with an R line.
  "tool-detector-phenotype": { ...METHODS["phenotype-excess"], id: "tool-detector-phenotype", r: DETECTOR_R("phenotype_excess") },
  "tool-detector-profile": { ...METHODS["profile-excess"], id: "tool-detector-profile", r: DETECTOR_R("profile_excess") },
};

/** Fills `{letter}` placeholders from `values`; unknown placeholders stay as written. */
export function fillTemplate(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{([A-Za-z]+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}
