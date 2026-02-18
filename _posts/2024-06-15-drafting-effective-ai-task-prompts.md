---
layout: post
title: "Drafting Effective Tasks for AI Pair Programming"
summary: A repeatable framework for briefing ChatGPT or GitHub Copilot X before diving into implementation work.
author: jkamsker
date: '2024-06-15 10:00:00 +0000'
category: guides
thumbnail: /assets/img/posts/code.jpg
keywords: ai pair programming, chatgpt prompts, codex workflow, software planning, productivity
tags: [ai, workflow, productivity]
permalink: /blog/drafting-effective-ai-task-prompts/
---

When I use ChatGPT or GitHub Copilot X (the Codex web UI) as my remote programming partner, the quality of the help I receive depends on the clarity of the brief I give it. The raw notes below evolved into a structured ritual that keeps the conversation focused on outcomes instead of diving into premature implementation details. This article distills that routine into a reusable, human-readable checklist.

## Start with the feature, not the fix

Begin every engagement by writing down the feature you are trying to ship. Resist the temptation to anchor the discussion around a particular class, method, or algorithm; those are solutions. Instead, explain what the user should be able to do when you are finished. I keep the following guard rails in mind:

- **Frame the feature** as a capability or improvement that someone can experience.
- **Describe current pain points** or gaps in capability using plain language.
- **Clarify success** with an explicit before/after statement: “Today it works like this…after the change it should work like that.”

This keeps the assistant centred on value, not code snippets.

## Gather context before requesting changes

Once the feature outcome is clear, copy the entire brief into the Codex plan mode and ask it to examine the repository. Useful prompts include:

```text
Here is a feature that I want to implement. Please analyze the codebase and collect information about the current implementation and what changes would be necessary.
```

Codex will typically respond with an outline of the affected areas, relevant files, and unanswered questions. Treat that response as a reconnaissance report. If anything feels off, refine your brief and rerun the request until the plan feels credible.

## Close the loop inside ChatGPT

After Codex has explored the repo, paste every version of its response back into the ChatGPT conversation. Ask ChatGPT to consolidate those findings into a detailed plan. Automating the copy/paste with a browser userscript saves time here. The compiled plan should include:

- The architectural approach and any new structures that need to be introduced.
- How responsibilities will shift between existing components.
- Open questions or risks that deserve further investigation.

Only when the plan satisfies you should you move on to execution.

## Turn plans into actionable task lists

With the high-level plan in hand, return to Codex and request a task list with checkboxes that you can track as you implement. A simple follow-up prompt works:

```text
Please create a .md file with the epic and checkboxes per task. Then go on and implement the first few tasks:
[PASTE TASKS HERE]
```

Saving this checklist in the repository keeps the scope visible and lets you revisit the remaining tasks after the initial iteration is complete.

## Embrace parallel exploration

Finally, keep multiple tasks moving in parallel. Four active threads strike a balance between exploration and depth: enough variety to collect strong ideas, but not so many that you lose track of progress. As you iterate, capture learnings in the original ChatGPT conversation so your future self—and any collaborators—can reason about the trade-offs that shaped the work.

By ritualising the way you brief AI collaborators, you ensure that each session starts with clarity, produces tangible artefacts, and ends with a confident plan of attack.
