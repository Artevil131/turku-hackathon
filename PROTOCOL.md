# Protocol

The git history of `experiments/` is the project's lab notebook. Each
experiment is one directory, and its history records what was predicted,
when, and what came out. The record format (the five headings and the
status values) follows the one used in Biology-constrained-ML, so records
read the same across our projects.

## An experiment, start to finish

1. **Plan.** Copy `experiments/TEMPLATE.md` to
   `experiments/NNNN-short-slug/README.md`, taking the next free
   four-digit number on `main`. Fill in Goal, Hypothesis and Experiment,
   leave Result and Interpretation empty, keep `status: proposed`, and
   commit the plan on its own before running anything:

       NNNN plan: <the goal in one line>

   The commit date is the evidence that the prediction came before the
   result.

2. **Run.** Configuration, glue code and small outputs live in the
   experiment's directory. Anything reusable (a loader, a metric, an
   embedding call, a search index) goes in `libs/utils` and the experiment
   imports it. Commit as the work goes, `NNNN: <what changed>`.

3. **Close.** Fill in Result and Interpretation, set `status: accepted`,
   and commit:

       NNNN result: <the finding in one line, with its number>

   A refuted hypothesis closes the same way.

After the plan commit, Goal, Hypothesis and Experiment stay as written. A
change of method goes into Result under "Deviations from plan", with the
reason. An experiment abandoned before it produced a result gets
`status: rejected` and one line saying why. An experiment replaced by a
later one gets `status: superseded`, and the later one names it in
`parent`.

Exploratory work (describing a dataset, trying a model to see what it
does) is allowed and says so under Hypothesis. It supports no claim beyond
the description. A pattern it turns up becomes the hypothesis of a new
experiment, tested on data or settings the exploration did not touch.

Two commands read the notebook:

    git log --oneline -- experiments/              # the project's timeline
    git log -p -- experiments/NNNN-*/README.md     # one experiment: plan, then result

## Rules for claims

- **A claim that something helps is measured against a baseline** that
  the team agreed on before the run and that differs only in the thing
  being credited, with the same data and budget.
- **Seeds and spread.** Every compared number reports how many runs were
  made and the spread across them. A difference smaller than the spread is
  not claimed.
- **Pinned data.** Every experiment names the dataset version and the
  filters applied, because results change when the data changes.
- **Numbers tagged by origin:** measured (in the data), computed (by a run
  in this repository), derived (by calculation from other numbers), or
  assumed.
- **Methods come from DECISIONS.md.** The metric, the statistical test and
  any threshold are chosen by the team, not by whoever (or whatever agent)
  runs the experiment.

## Data and outputs

Datasets go in `data/`, which git ignores, downloaded by a script in
`scripts/`. Nothing over 10 MB is committed. A larger output stays out of
git, and its record gives the file's sha256 and the command that
regenerates it.
