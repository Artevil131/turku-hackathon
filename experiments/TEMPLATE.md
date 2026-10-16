---
status: proposed    # proposed, then accepted, rejected or superseded
by:                 # who ran it: a name, or the agent harness and its operator
data: []            # dataset names and versions, e.g. [reviews-2026-10-16]
parent:             # the experiment this one follows up or replaces, if any
---

# NNNN Title

## Goal

What the experiment should establish, and which decision or next
experiment depends on the answer.

## Hypothesis

The prediction, in a form a number can refute: the quantity, the
comparison, the direction and the threshold. Exploratory work says so here
and names what will be described.

## Experiment

Data (version, filters, thresholds), the utils and apps used, budget, each
baseline and what it controls for, seeds, metric, statistical test (all
from DECISIONS.md). Enough for someone else to rerun it.

## Result

Filled in at close. The numbers, each tagged measured, computed, derived or
assumed, with seeds and spread. Deviations from plan and why. Where the
outputs are and the command that regenerates them.

## Interpretation

Filled in at close. What the result means for the hypothesis and the goal,
the strongest alternative explanation, and the next experiment it suggests.
