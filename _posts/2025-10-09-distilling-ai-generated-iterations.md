---
layout: post
title: "Distilling Multiple AI Iterations into a Single Winning Pull Request"
summary: How to evaluate, compare, and merge Codex-generated branches without losing the bigger picture.
author: jkamsker
date: '2025-10-09 12:00:00 +0000'
category: guides
thumbnail: /assets/img/posts/code.jpg
keywords: ai code review, codex workflow, pull request evaluation, software process, productivity
tags: [ai, workflow, git]
permalink: /blog/distilling-ai-generated-iterations/
---

Generating several candidate implementations with Codex is easy; choosing the right one (and capturing the learnings) is the real art. These notes outline how I shepherd multiple AI-produced branches through a structured review so that the best ideas survive and the rest inform future work.

## Expect variation and iterate deliberately

Codex output can swing wildly in quality. Instead of betting on a single response, request multiple iterations of the same feature. I typically generate four parallel branches and treat them as competing design ideas. Each run should:

- Start from the same source branch to keep diffs comparable.
- Follow the same high-level plan that ChatGPT produced earlier.
- Produce a short changelog or markdown summary describing the approach.

## Capture evidence for every branch

Before deciding which branch survives, gather objective evidence:

1. **Clone or check out each pull request** into its own worktree (for example, `../LiteDB.worktrees`). Keeping them side-by-side makes comparison painless.
2. **Record the repository status** using `gh pr list` or similar tooling so you always know which branch maps to which Codex run.
3. **Sync with the master plan** stored in documentation (such as `docs/Spatial-Revamp`) to ensure every iteration addresses the same checklist of requirements.

This creates a paper trail that you can paste back into ChatGPT when it is time to synthesize.

## Let ChatGPT be the reviewer

Once the branches exist, ask ChatGPT to evaluate them. Provide the command output, diffs, and any markdown summaries produced by Codex. Helpful prompts sound like:

```text
Please check out all PRs in different worktrees and evaluate which PR is the best or what combination would be ideal. Mixing approaches is allowed-take the best of all worlds.
```

Encourage the model to grade each branch against the plan, call out missing pieces, and suggest how to blend strengths if necessary.

## Aggregate the findings

When multiple evaluation rounds occur, collate the feedback before asking for a final verdict. A reliable pattern is:

```text
Here is another set of findings. Please check whether they add anything new:
[PASTE SUMMARIES HERE]
```

ChatGPT can then produce a decision matrix such as:

| Category | Source | Action |
| --- | --- | --- |
| Correct normalization | #58 | Keep as baseline |
| Descriptor metadata | #60 / #57 | Add to persistence |
| Automatic backfill/index creation | #61 | Integrate |

This makes trade-offs explicit and tells you exactly what to keep, merge, or discard.

## Finish with a curated merge

Armed with the matrix, return to Codex (or your local environment) and perform the final merge manually. The goal is not to auto-merge everything but to craft a single high-quality pull request that:

- Preserves the strongest implementation choices.
- Documents any deliberate omissions or deferred tasks.
- Links back to the evaluation artefacts for future reference.

By treating each AI-generated branch as a hypothesis, you transform a noisy stream of drafts into an orderly, evidence-backed workflow that consistently ships better code.
