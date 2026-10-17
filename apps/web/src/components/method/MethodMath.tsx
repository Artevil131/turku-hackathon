import { type Locale, type MessageKey, t } from "@aei/i18n";
import type { ReactNode } from "react";

// Formulas for the Method page, typeset as native MathML (no library). Each block states the rule the tool runs or
// the experiment tested, with the decision or record it rests on. LaTeX source sits behind a disclosure for slides.

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

function Display({ label, children }: { label: string; children: ReactNode }) {
  // Inline math in a block wrapper, so the equation keeps display style (CSS math-style) but sits left-aligned.
  return (
    <div className="mt-eq">
      <math aria-label={label}>{children}</math>
    </div>
  );
}

const LATEX = String.raw`a_{t\mid t-1} = \delta\,a_{t-1} + (1-\delta)\,M p_0, \qquad
b_{t\mid t-1} = \delta\,b_{t-1} + (1-\delta)\,M (1-p_0)

p_t \mid \mathcal{D}_t \sim \mathrm{Beta}\big(a_{t\mid t-1} + s_t,\; b_{t\mid t-1} + n_t - s_t\big) = \mathrm{Beta}(a_t, b_t)

s_{t+1} \mid \mathcal{D}_t \sim \mathrm{BetaBin}(n_{t+1}, a_t, b_t), \qquad
\mathbb{E}[p_t] = \frac{a_t}{a_t + b_t}, \qquad w_t = \frac{n^{\mathrm{eff}}_t}{n^{\mathrm{eff}}_t + M},\; n^{\mathrm{eff}}_t = a_t + b_t - M`;

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
      <h3 className="mt-label" id="mt-bb">
        {t(locale, "methodBbTitle")}
      </h3>
      <p className="mt-math-line">{t(locale, "methodBbConjugate")}</p>
      <Display label={t(locale, "methodBbDiscountLabel")}>
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
      <Display label={t(locale, "methodBbUpdateLabel")}>
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
      <Display label={t(locale, "methodBbPredictLabel")}>
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
      <ul className="mt-math-notes">
        <li>{t(locale, "methodBbSymbols")}</li>
        <li>{t(locale, "methodBbExact")}</li>
        <li>{t(locale, "methodBbStatus")}</li>
      </ul>
      <details className="mt-latex">
        <summary>LaTeX</summary>
        <pre>
          <code>{LATEX}</code>
        </pre>
      </details>
    </section>
  );
}

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
        <mi mathvariant="normal">Poisson</mi>
        <O>(</O>
        <I>μ</I>
        <O>)</O>
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
        <I>P</I>
        <O>(</O>
        <I>X</I>
        <O>≥</O>
        <I>x</I>
        <O>)</O>
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
    <dl className="mt-rules">
      {rules.map((r) => (
        <div key={r} className="mt-rule">
          <dt>{t(locale, `methodRule_${r}` as MessageKey)}</dt>
          <dd>
            {formulas[r]}
            <span className="mt-rule-note">{t(locale, `methodRuleNote_${r}` as MessageKey)}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
