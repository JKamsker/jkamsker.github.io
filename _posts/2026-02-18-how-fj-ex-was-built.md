---
layout: post
title: "Forgejo's CLI Doesn't Offer a Way to See Build Details? Fine, I Do It Myself Then"
summary: The Forgejo API doesn't expose Actions properly. So I scraped the web UI and built a CLI that does.
author: jkamsker
date: '2026-02-18 12:00:00 +0000'
category: devlog
thumbnail: /assets/img/posts/code.jpg
keywords: rust, forgejo, cli, forgejo-actions, ci-cd, web-scraping, developer-tools
tags: [rust, cli, devops]
permalink: /blog/how-fj-ex-was-built/
---

## The Frustration

[Forgejo CLI (`fj`)](https://codeberg.org/forgejo-contrib/forgejo-cli/) is great. It's the `gh` equivalent for Forgejo — repos, issues, PRs, releases, all from the terminal. Solid tool.

But try working with **Forgejo Actions** and you'll hit a wall real fast. Want to download logs from a failed build? Open the browser. Grab artifacts? Browser. Cancel a stuck run? Browser. Rerun a job? You guessed it — *browser*.

The API simply doesn't expose these features. They only exist behind the web UI. So every time a build breaks, you're alt-tabbing, navigating, clicking, waiting, downloading. Across multiple repos. Multiple times a day.

I got tired of it.

## Phase 1: "Let Me Just Write a Quick Script"

Famous last words. It started as a few PowerShell scripts in an internal work repo. Nothing fancy — just enough automation to stop me from clicking through the UI ten times a day.

But while hacking those scripts together, I found something that made the whole thing viable: Forgejo's web UI embeds structured JSON directly in `data-*` HTML attributes. The run list page stuffs all the job data into `data-initial-post-response`. Artifacts? `data-initial-artifacts-response`. It's just... *sitting there*. No JavaScript rendering needed, no DOM parsing — fetch the page, regex out the attribute, parse the JSON. Done.

The scripts worked. For a while. Then I wanted to add one more feature, and suddenly I was fighting PowerShell's quirks more than solving the actual problem.

You know what that means.

## Phase 2: "Alright, Let's Do This Properly"

Time for Rust. But I had one rule: **don't compete with `fj`, extend it**. Hence the name — `fj-ex`, Forgejo CLI *Extension*. Not a fork, not a replacement, a companion.

That meant copying `fj`'s homework on purpose. Same `--host/-H`, `--repo/-r`, `--remote/-R` flags. Same git-remote inference. Same subcommand style. If you already use `fj`, your muscle memory carries over. No learning curve, no "wait, which flag was it again?"

## The Trick That Makes It All Work

Here's the fun part. Since Forgejo's API won't cooperate, `fj-ex` just... pretends to be a browser. It makes the exact same HTTP requests your browser would:

```
GET  /{repo}/actions?list_inner=true   → runs list
GET  /{repo}/actions/runs/{N}          → run details (JSON hiding in HTML)
GET  /{repo}/actions/runs/{N}/jobs/…   → raw log download
GET  /{repo}/actions/runs/{N}/artifacts → artifact list (actual JSON!)
POST /{repo}/actions/runs/{N}/cancel   → cancel run
POST /{repo}/actions/runs/{N}/rerun    → rerun
```

Most responses either return JSON directly or embed it in those `data-*` attributes I mentioned. A regex, a bit of HTML entity decoding, and you've got clean structured data. No headless browser. No DOM parser. Just good old HTTP requests and pattern matching.

For cancel and rerun, it needs to extract the CSRF token from the page first — same as a browser submitting a form. A small hoop to jump through, but nothing dramatic.

## "Wait, How Does It Log In?"

Ah, yes. The spicy part.

There's no API token for these endpoints. So `fj-ex` logs in the old-fashioned way — like a human filling out the login form:

1. Fetch the login page, grab the CSRF token
2. POST username + password + CSRF
3. Stash the cookies
4. If a later request gets redirected to `/user/login`? Auto-relogin, no interruption

Does this mean storing credentials in plaintext? Yes. Is that ideal? No. Is there an alternative when you're authenticating against a login form that doesn't support tokens? Also no.

The README doesn't hide this. You know what you're signing up for.

## The Payoff

All that effort boils down to this — instead of browser tabs, you get:

```bash
# What's going on?
fj-ex actions runs

# Show me the logs
fj-ex actions logs job 42

# Give me the artifacts
fj-ex actions artifacts download 15

# This run is stuck, kill it
fj-ex actions cancel 15

# Try again
fj-ex actions rerun 15
```

Terminal. One line. Done. Same repo-targeting flags as `fj`, so switching between repos is just a `-r` flag away.

## Is This Cursed? A Little.

Let's be honest — building a CLI on top of web scraping is not the noble path. If Forgejo changes their HTML structure tomorrow, things break. That's the deal.

But the alternative was either contributing the missing API endpoints upstream (a much larger undertaking) or continuing to click through the UI like it's 2005. I chose the pragmatic option.

And if Forgejo does add proper API support for Actions someday? Great — migrating `fj-ex` away from scraping will be straightforward. The commands stay the same, only the plumbing changes.

Until then, it works, and it's [on crates.io](https://crates.io/crates/forgejo-cli-ex) with pre-built binaries for Linux, Windows, and macOS.

No more alt-tabbing.
