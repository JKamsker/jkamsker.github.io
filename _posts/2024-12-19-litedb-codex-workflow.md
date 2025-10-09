---
layout: post
title: "LiteDB Codex Workflow: Managing Large-Scale Development Tasks"
summary: "A comprehensive workflow for handling really large and long-running development tasks using GitHub Codex and ChatGPT"
author: johndoe
date: '2024-12-19 10:00:00 +0000'
category: guides
thumbnail: /assets/img/posts/code.jpg
keywords: codex, chatgpt, workflow, development, litedb, ai-assisted coding, github copilot
permalink: /blog/litedb-codex-workflow/
---

When working on large-scale development projects, particularly those involving extensive refactoring or feature implementation, managing the workflow can be challenging. This post outlines a proven workflow designed for really large and long-running tasks that can't be easily implemented by Codex in one go.

## Overview

The workflow combines the strengths of ChatGPT for planning and GitHub Codex for implementation, using an iterative distillation process to achieve the best results.

## The Workflow

### 1. Draft a Task in ChatGPT

Start by drafting your high-level task in ChatGPT. For example:
- **Task**: Spatial Revamp - Extract Spatial Features out into separate Classes, extend.

Focus on:
- How you want to use the feature rather than implementation details
- New structures and what goes where
- The end goal and user experience

### 2. Initial Analysis with Codex

Copy and paste the rough task to Codex (web) and let it draft plans in plan mode:

```
Here is a feature which I want to implement. Please analyze the codebase 
and collect information about the current implementation and what changes 
would be necessary.
[Feature from ChatGPT]
```

When finished, copy all versions back to the original ChatGPT chat and ask it to create a detailed plan.

### 3. Create a Tasklist

Copy the plan to Codex and ask it to create a tasklist including checkboxes to track progress:

```
Please create a .md file with the epic and checkboxes per Task. 
Then go on and implement the first few tasks:
[YOUR TASKS HERE]
```

**Pro Tip**: Always use 4 parallel tasks at a time to get the best results.

## The Distillation Process

The quality of Codex output varies and may require multiple iterations to achieve the desired outcome. Here's how to distill the best solution:

### Step 1: Generate Multiple Solutions

Create PRs for each version that Codex generates. List them using:

```bash
gh pr list
```

You'll see something like:

```
Showing 18 of 18 open pull requests in JKamsker/LiteDB

ID   TITLE                                                            BRANCH
#67  Add spatial resolver diagnostics and GeoJSON serializer          codex/implement-spatial-features-enhancements-3z3gfx
#66  Implement spatial resolver, diagnostics, and GeoJSON serializer  codex/implement-spatial-features-enhancements-c5g40u
#65  Add spatial LINQ resolver diagnostics and GeoJSON support        codex/implement-spatial-features-enhancements-klf5lq
#64  Implement spatial resolver diagnostics and GeoJSON               codex/implement-spatial-features-enhancements
```

### Step 2: Evaluate with Codex

Copy and paste the PR list into this template:

```
Please check out all PR's in different worktrees in `..\LiteDB.worktrees` 
(outside the workspace) and evaluate which PR is the best/which one should 
I accept. Mixing would also be possible: Take the best of all worlds. 
Overall plan is in: `docs\Spatial-Revamp` each branch should have checklists.

[PR LIST FROM ABOVE]

Git repo is at `https://github.com/JKamsker/LiteDB`
We are currently in `feat/spatial-revamp`

Your git might be funny, ensure `https://github.com/JKamsker/LiteDB` is 
the remote and the `feat/spatial-revamp` branch is checked out before 
starting with the assessment
```

### Step 3: Aggregate Findings

Codex will evaluate each PR based on the overall plan and create Markdown files with the details. Copy these back to ChatGPT and ask it to create a detailed plan:

```
Please aggregate findings:
```

For larger sets of findings, batch them:

```
Here is another set of findings, please check those if they have 
something to add:
```

ChatGPT will draft a detailed plan showing what to merge and what might be missing. You'll get something like:

| Category                                           | Source  | Action             |
| -------------------------------------------------- | ------- | ------------------ |
| **Correct normalization**                          | #58     | Keep as baseline   |
| **Descriptor metadata (AxisExtent, DistanceMode)** | #60/#57 | Add to persistence |
| **Automatic backfill/index creation**              | #61     | Integrate          |
| **Modular packaging**                              | #59     | Re-adopt           |
| **Anti-meridian covering**                         | #58     | Retain             |
| **Tolerance math**                                 | #56     | Confirm additive   |
| **Dual distance support**                          | #58/#60 | Keep               |
| **Checklist/docs**                                 | all     | Synchronize        |

### Step 4: Final Integration

Take the plan from ChatGPT and ask Codex to implement it:

```
Please check out all relevant PR's in different worktrees in `..\LiteDB.worktrees` 
(outside the workspace). Take the best of all worlds. 
Overall plan is in: `docs\Spatial-Revamp` each branch should have checklists.

[PR LIST]

Git repo is at `https://github.com/JKamsker/LiteDB`
We are currently in `codex/continue-s5-s6-s7-in-spatial-modular-revamp-0iseeu`

Here is the plan:
[PLAN FROM CHATGPT]
```

## The Iteration Cycle

This process creates multiple versions of the same merge:
1. PR them all
2. Run `gh pr list`
3. Let Codex review

**Decision Points:**
- If it finds exactly one good PR, approve and merge to the feature branch
- If it finds multiple good PRs, it will suggest one starting point and salvage parts of others - use Codex locally to incorporate those changes

**Rinse and repeat** for all remaining steps until your feature is complete.

## Key Takeaways

1. **Parallel Processing**: Always run 4 parallel tasks for optimal results
2. **Iterative Refinement**: Don't expect perfection on the first try - distill and improve
3. **Best of All Worlds**: Don't settle for one solution - combine the best parts of multiple attempts
4. **ChatGPT for Planning**: Use ChatGPT's strength in high-level planning and aggregation
5. **Codex for Implementation**: Leverage Codex for actual code generation and analysis

This workflow has proven effective for managing complex, large-scale development tasks that would be impossible to complete in a single Codex session. By breaking down the work, generating multiple solutions, and systematically evaluating and combining them, you can achieve high-quality results even for the most challenging refactoring and feature implementation tasks.
