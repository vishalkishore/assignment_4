---
name: ml-paper-writing
description: >-
  Write and revise empirical machine-learning papers, research reports, and
  LaTeX manuscripts in clear, plain English. Turn research notes into an
  outline or draft. Write abstracts, introductions, methods, results,
  discussions, figures and captions. Review a paper when asked.
argument-hint: "[outline | draft | revise | review] [files or instructions]"
---

# Write an ML paper

Use the mode the user asks for. If they ask for a section, write that section.
Before you edit, read the manuscript, the figures and the result files that
the text depends on. If they ask for a review, give findings and fixes, not
rewritten text.

These are defaults, not rules. Adapt them to the paper, the venue and the
author.

## 1. Find the story first

A reader keeps only a few sentences from a paper. Choose them before you write.

1. What question does the work answer?
2. Who needs the answer, and why?
3. What did you learn? Write one to three claims, one sentence each, scoped to
   the models and settings you tested.
4. What is the strongest evidence for each claim, and where does it come from?
5. What does prior work already show, and what does this paper add?
6. What is the one takeaway?

Let each main section carry one claim. Give it a title that states the finding
("Romanized Hindi is the weak form"), not only the activity ("Diagnosis").
Anything that does not support a claim goes to the appendix.

## 2. Make claims as strong as the evidence

- Match the wording to the evidence: "in one model", "suggests", "a
  correlation over ten conditions". Keep a measured result (a direction, an
  angle, an AUROC) apart from a causal claim about behaviour.
- Say which data you used to choose the method. If a later test (for example,
  an out-of-distribution set) confirms part of the result, say which part.
- If a component adds little, say so next to the result.
- Report mixed results success-first: what held, then what missed and why
  (for example, the base rate was already low).
- Call exploratory work exploratory. Keep pending numbers out of
  submission-ready text, or mark them clearly as not yet measured.

## 3. Write each part for its job

### Abstract
Give each sentence one job: the field, the gap, each claim with its key
number, the limits, and the implication. Open with the real problem, not with
how important AI is. Make the limits sentence specific and honest.

### Introduction
- First paragraph: the problem, why it matters, and the research question.
  Show a small concrete example early, such as one input in each condition.
- Then what is known and why it is not enough, with citations.
- Then one short paragraph per claim, with its key evidence and the figure
  panel that shows it.
- Then the impact: who should do what differently.
- End with contributions, each with a number.

A first figure that shows the whole story (problem, cause, result) helps
readers who only skim.

### Methods
Follow the path of the data. Give the idea first, then the detail. Define each
term and symbol where it first appears. State what goes in, what changes and
what comes out. Give the data, splits, baselines, metrics and selection rules
needed to reproduce the work. Put long derivations in the appendix.

For each method part, a good order is: the problem it solves, the design, the
equation with "where …" definitions, and what it does. Put hyperparameters in
a table, one row per part.

### Results
Give each subsection one question. Name the setting and the comparison, report
what you saw, then say what it supports. Keep methods next to the results they
produce. Put side questions (such as "why this layer") at the end of the
section or in the appendix.

### Discussion, limitations, related work, conclusion
Give each limitation its reason and its effect on the claims. Related work can
come near the end if the introduction already gives the context; explain how
this paper differs. A conclusion of three or four sentences that restates the
takeaway is enough.

## 4. Write plainly

- Keep sentences short, about 25 words or less, with one idea each. One topic
  per paragraph, stated in its first sentence.
- Use the active voice and common words. Use a technical term only when it is
  the precise word, and explain it before you use it.
- Keep the subject near the verb. Avoid long strings of nouns.
- Use one name for one concept everywhere: text, tables, figures, appendix.
- Prefer plain phrases to jargon when nothing is lost: "success criteria set
  before the run" reads better than "pre-registered checks R1–R4".
- Skip rhetorical questions when the point is already clear.
- Replace "significant", "robust" and "substantial" with the number, its unit
  and the comparison, or with the evidence behind the word.
- Mark the good direction of each metric with ↑ or ↓.

Example (fictional numbers):

> We tested whether a smaller attention window lowers peak GPU memory. On
> 16K-token inputs, cutting the window from 4,096 to 2,048 tokens lowered peak
> memory from 36.2 GB to 33.8 GB. Validation accuracy fell from 82.1% to 81.8%.

## 5. Keep the numbers right

- Do not type result numbers. Generate them from the results tables (for
  example, as LaTeX macros), so text, tables and figures always agree.
- Keep a small script that checks plotted values and text numbers against the
  tables, and run it after each change.
- Before you write a sentence about a result, open its source. Check the
  number, direction, unit, setting and baseline.
- Give confidence intervals for the main comparisons; point estimates are
  fine elsewhere. When a figure carries the result, still give the one or two
  key numbers in the text.
- If the requested wording does not match the data, keep the data and tell the
  author briefly.

## 6. Make figures carry one message

- Decide what each figure should say, then design for that. A diagram for a
  process, a plot for a trend, a table for exact values.
- Use one accent colour for what the reader should follow, and keep each
  colour's meaning the same across figures. Draw the rest in thin black or
  grey, labelled directly on the lines.
- Build figures at the printed text width so fonts stay readable. Keep labels
  and legends off the data.
- A caption first says what is shown (setting, comparison, metric), then the
  message in plain words. Define any error bars.
- Place each figure near the text that cites it. In the appendix, inline
  figures and tables avoid large empty gaps.
- After each change, build the PDF and look at the pages.

## 7. Work in passes, and test with a reader

1. Write the claims and takeaway. Outline the sections and figures.
2. Draft, build, and look at the pages.
3. Give only the extracted text to a fresh reader (for example, a sub-agent).
   Ask for the question, the claims, the evidence and the limits, and where
   they got confused.
4. Fix what the reader missed. Repeat until they get it right.

When the author gives exact wording, use it, check it against the data, and
note any conflict in one line.

For a review, give each finding a location, why it matters, and a concrete
fix. Put scientific correctness first, then clarity.

Adapted from Neel Nanda's [Highly Opinionated Advice on How to Write ML Papers](https://www.alignmentforum.org/posts/eJGptPbbFPZGLpjsp/highly-opinionated-advice-on-how-to-write-ml-papers).
