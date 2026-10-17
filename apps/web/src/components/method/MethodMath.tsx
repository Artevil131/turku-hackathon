import { type Locale, type MessageKey, t } from "@aei/i18n";
import type { ReactNode } from "react";

// Formulas for the Method page, typeset as native MathML (no library). Each block states the rule the tool runs or
// the experiment tested, with the decision or record it rests on. Each rule shows the decision or record it rests on.

const I = ({ children }: { children: ReactNode }) => <mi>{children}</mi>;
const N = ({ children }: { children: ReactNode }) => <mn>{children}</mn>;
const O = ({ children }: { children: ReactNode }) => <mo>{children}</mo>;
const Sub = ({ b, s }: { b: ReactNode; s: ReactNode }) => (
  <msub>
    {b}
    {s}
  </msub>
);
const Frac = ({ n, d }: { n: ReactNode; d: ReactNode }) => (
  <mfrac>
    {n}
    {d}
  </mfrac>
);
const Row = ({ children }: { children: ReactNode }) => <mrow>{children}</mrow>;

/** Subscript t, t−1 and t|t−1 as rows. */
const t0 = <I>t</I>;
const t1 = (
  <Row>
    <I>t</I>
    <O>−</O>
    <N>1</N>
  </Row>
);
const tt1 = (
  <Row>
    <I>t</I>
    <O>|</O>
    <I>t</I>
    <O>−</O>
    <N>1</N>
  </Row>
);

function Display({ n, label, children }: { n: number; label: string; children: ReactNode }) {
  // One step of the filter: a number, its caption, and the equation in display style, left-aligned.
  return (
    <li className="mt-eqrow">
      <span className="mt-eqnum" aria-hidden="true">
        {n}
      </span>
      <span className="mt-eqtag">{label}</span>
      <div className="mt-eq">
        <math aria-label={label}>{children}</math>
      </div>
    </li>
  );
}

/** The discounted Beta-binomial: why it stays conjugate week after week (ENGINE.md 2.2, D-038, experiment 0012). */
export function BetaBinomialMath({ locale }: { locale: Locale }) {
  const a = <I>a</I>;
  const b = <I>b</I>;
  const d = <I>δ</I>;
  const M = <I>M</I>;
  const p0 = <Sub b={<I>p</I>} s={<N>0</N>} />;
  const one = <N>1</N>;
  return (
    <section className="mt-math" aria-labelledby="mt-bb">
      <h3 className="mt-math-title" id="mt-bb">
        {t(locale, "methodBbTitle")}
      </h3>
      <p className="mt-math-lead">{t(locale, "methodBbConjugate")}</p>
      <ol className="mt-eqs">
        <Display n={1} label={t(locale, "methodBbDiscountLabel")}>
          <Sub b={a} s={tt1} />
          <O>=</O>
          {d}
          <Sub b={a} s={t1} />
          <O>+</O>
          <Row>
            <O>(</O>
            {one}
            <O>−</O>
            {d}
            <O>)</O>
          </Row>
          {M}
          {p0}
          <mspace width="1.5em" />
          <Sub b={b} s={tt1} />
          <O>=</O>
          {d}
          <Sub b={b} s={t1} />
          <O>+</O>
          <Row>
            <O>(</O>
            {one}
            <O>−</O>
            {d}
            <O>)</O>
          </Row>
          {M}
          <Row>
            <O>(</O>
            {one}
            <O>−</O>
            {p0}
            <O>)</O>
          </Row>
        </Display>
        <Display n={2} label={t(locale, "methodBbUpdateLabel")}>
          <Sub b={<I>p</I>} s={t0} />
          <O>∣</O>
          <Sub b={<I>𝒟</I>} s={t0} />
          <O>∼</O>
          <mi mathvariant="normal">Beta</mi>
          <Row>
            <O>(</O>
            <Sub b={a} s={tt1} />
            <O>+</O>
            <Sub b={<I>s</I>} s={t0} />
            <O>,</O>
            <Sub b={b} s={tt1} />
            <O>+</O>
            <Sub b={<I>n</I>} s={t0} />
            <O>−</O>
            <Sub b={<I>s</I>} s={t0} />
            <O>)</O>
          </Row>
          <O>=</O>
          <mi mathvariant="normal">Beta</mi>
          <Row>
            <O>(</O>
            <Sub b={a} s={t0} />
            <O>,</O>
            <Sub b={b} s={t0} />
            <O>)</O>
          </Row>
        </Display>
        <Display n={3} label={t(locale, "methodBbPredictLabel")}>
          <Sub
            b={<I>s</I>}
            s={
              <Row>
                <I>t</I>
                <O>+</O>
                <N>1</N>
              </Row>
            }
          />
          <O>∣</O>
          <Sub b={<I>𝒟</I>} s={t0} />
          <O>∼</O>
          <mi mathvariant="normal">BetaBin</mi>
          <Row>
            <O>(</O>
            <Sub
              b={<I>n</I>}
              s={
                <Row>
                  <I>t</I>
                  <O>+</O>
                  <N>1</N>
                </Row>
              }
            />
            <O>,</O>
            <Sub b={a} s={t0} />
            <O>,</O>
            <Sub b={b} s={t0} />
            <O>)</O>
          </Row>
          <O>,</O>
          <mspace width="1.5em" />
          <mi mathvariant="normal">E</mi>
          <Row>
            <O>[</O>
            <Sub b={<I>p</I>} s={t0} />
            <O>]</O>
          </Row>
          <O>=</O>
          <Frac
            n={<Sub b={a} s={t0} />}
            d={
              <Row>
                <Sub b={a} s={t0} />
                <O>+</O>
                <Sub b={b} s={t0} />
              </Row>
            }
          />
        </Display>
      </ol>
      <p className="mt-math-foot">{t(locale, "methodBbSymbols")}</p>
      <p className="mt-math-foot">{t(locale, "methodBbExact")}</p>
      <p className="mt-status">{t(locale, "methodBbStatus")}</p>
    </section>
  );
}

/** Card widths in the three-column grid: wide spans two columns, full spans the row. */
const WIDE = new Set(["wilson", "poisson", "drop"]);
const FULL = new Set(["trend"]);

/** One formula line per rule the tool runs, with the decision it rests on. */
export function LiveRulesMath({
  locale,
  rules,
}: {
  locale: Locale;
  rules: ("wilson" | "poisson" | "drop" | "empty" | "trend" | "sentinel")[];
}) {
  const p = (
    <mover accent="true">
      <I>p</I>
      <O>^</O>
    </mover>
  );
  const z = <I>z</I>;
  const n = <I>n</I>;
  const formulas: Record<string, ReactNode> = {
    wilson: (
      <math aria-label="Wilson interval">
        <Frac
          n={
            <Row>
              {p}
              <O>+</O>
              <Frac
                n={
                  <msup>
                    {z}
                    <N>2</N>
                  </msup>
                }
                d={
                  <Row>
                    <N>2</N>
                    {n}
                  </Row>
                }
              />
              <O>±</O>
              {z}
              <msqrt>
                <Frac
                  n={
                    <Row>
                      {p}
                      <O>(</O>
                      <N>1</N>
                      <O>−</O>
                      {p}
                      <O>)</O>
                    </Row>
                  }
                  d={n}
                />
                <O>+</O>
                <Frac
                  n={
                    <msup>
                      {z}
                      <N>2</N>
                    </msup>
                  }
                  d={
                    <Row>
                      <N>4</N>
                      <msup>
                        {n}
                        <N>2</N>
                      </msup>
                    </Row>
                  }
                />
              </msqrt>
            </Row>
          }
          d={
            <Row>
              <N>1</N>
              <O>+</O>
              <Frac
                n={
                  <msup>
                    {z}
                    <N>2</N>
                  </msup>
                }
                d={n}
              />
            </Row>
          }
        />
      </math>
    ),
    poisson: (
      <math aria-label="Poisson excess">
        <I>X</I>
        <O>∼</O>
        <Row>
          <mi mathvariant="normal">Poisson</mi>
          <O>(</O>
          <I>μ</I>
          <O>)</O>
        </Row>
        <O>,</O>
        <mspace width="0.6em" />
        <I>μ</I>
        <O>=</O>
        <Sub b={<I>N</I>} s={<mi mathvariant="normal">window</mi>} />
        <O>·</O>
        <Frac
          n={
            <Row>
              <I>c</I>
              <O>+</O>
              <Frac n={<N>1</N>} d={<N>2</N>} />
            </Row>
          }
          d={
            <Row>
              <I>C</I>
              <O>+</O>
              <N>1</N>
            </Row>
          }
        />
        <O>,</O>
        <mspace width="0.6em" />
        <Row>
          <I>P</I>
          <O>(</O>
          <I>X</I>
          <O>≥</O>
          <I>x</I>
          <O>)</O>
        </Row>
        <O>&lt;</O>
        <I>α</I>
      </math>
    ),
    drop: (
      <math aria-label="Sampling drop">
        <Sub b={<I>X</I>} s={<N>7</N>} />
        <O>∼</O>
        <mi mathvariant="normal">Poisson</mi>
        <O>(</O>
        <N>7</N>
        <Sub
          b={
            <mover accent="true">
              <I>λ</I>
              <O>¯</O>
            </mover>
          }
          s={<N>56</N>}
        />
        <O>)</O>
        <O>,</O>
        <mspace width="0.6em" />
        <I>P</I>
        <O>(</O>
        <Sub b={<I>X</I>} s={<N>7</N>} />
        <O>≤</O>
        <I>x</I>
        <O>)</O>
        <O>&lt;</O>
        <msup>
          <N>10</N>
          <Row>
            <O>−</O>
            <N>4</N>
          </Row>
        </msup>
      </math>
    ),
    empty: (
      <math aria-label="Empty run">
        <msup>
          <I>e</I>
          <Row>
            <O>−</O>
            <I>λ</I>
            <I>L</I>
          </Row>
        </msup>
        <O>&lt;</O>
        <msup>
          <N>10</N>
          <Row>
            <O>−</O>
            <N>3</N>
          </Row>
        </msup>
      </math>
    ),
    trend: (
      <math aria-label="Cochran-Armitage trend">
        <I>Z</I>
        <O>=</O>
        <Frac
          n={
            <Row>
              <munder>
                <O>∑</O>
                <I>i</I>
              </munder>
              <I>i</I>
              <O>(</O>
              <Sub b={<I>e</I>} s={<I>i</I>} />
              <O>−</O>
              <Sub b={<I>n</I>} s={<I>i</I>} />
              <mover accent="true">
                <I>p</I>
                <O>¯</O>
              </mover>
              <O>)</O>
            </Row>
          }
          d={
            <msqrt>
              <mover accent="true">
                <I>p</I>
                <O>¯</O>
              </mover>
              <O>(</O>
              <N>1</N>
              <O>−</O>
              <mover accent="true">
                <I>p</I>
                <O>¯</O>
              </mover>
              <O>)</O>
              <O>(</O>
              <munder>
                <O>∑</O>
                <I>i</I>
              </munder>
              <Sub b={<I>n</I>} s={<I>i</I>} />
              <msup>
                <I>i</I>
                <N>2</N>
              </msup>
              <O>−</O>
              <msup>
                <Row>
                  <O>(</O>
                  <munder>
                    <O>∑</O>
                    <I>i</I>
                  </munder>
                  <Sub b={<I>n</I>} s={<I>i</I>} />
                  <I>i</I>
                  <O>)</O>
                </Row>
                <N>2</N>
              </msup>
              <O>/</O>
              <I>N</I>
              <O>)</O>
            </msqrt>
          }
        />
      </math>
    ),
    sentinel: (
      <math aria-label="New in unit">
        <msub>
          <I>n</I>
          <Row>
            <mi mathvariant="normal">MRSA/VRE</mi>
          </Row>
        </msub>
        <O>(</O>
        <I>t</I>
        <O>−</O>
        <N>180</N>
        <O>,</O>
        <I>t</I>
        <O>)</O>
        <O>=</O>
        <N>0</N>
      </math>
    ),
  };
  return (
    <ul className="mt-rules">
      {rules.map((r) => (
        <li key={r} className={FULL.has(r) ? "mt-rule mt-rule-full" : WIDE.has(r) ? "mt-rule mt-rule-wide" : "mt-rule"}>
          <span className="mt-rule-name">{t(locale, `methodRule_${r}` as MessageKey)}</span>
          <div className="mt-rule-eq">{formulas[r]}</div>
          <span className="mt-rule-note">{t(locale, `methodRuleNote_${r}` as MessageKey)}</span>
        </li>
      ))}
    </ul>
  );
}
