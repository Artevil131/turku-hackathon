# @aei/logistic

L2-penalised logistic regression for a handful of features, fitted by
Newton's method. Pure TypeScript, no dependencies.

    const model = fitLogistic(rows, outcomes, { l2: 1 });   // weights[0] is the intercept
    predict(model, row);                                     // probability of 1

The intercept is not penalised. Used by experiments/0004 (patient factors).

Relies on: D-004. Tests: `src/logistic.test.ts`.
