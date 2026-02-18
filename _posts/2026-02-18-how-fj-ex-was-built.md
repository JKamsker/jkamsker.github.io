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

## The Gap Nobody Filled

[Forgejo CLI (`fj`)](https://codeberg.org/forgejo-contrib/forgejo-cli/) is the `gh` equivalent for Forgejo — repos, issues, PRs, releases, all via the REST API. It's solid. But if you work with **Forgejo Actions** daily, you hit a wall fast.

Want to download a job's logs? Grab build artifacts? Cancel a stuck run? Rerun a failed workflow? None of that is exposed through the API. The only way to do it is to click through the web UI.

That gets old quickly when you're debugging CI failures across multiple repos.

## It Started With PowerShell Hacks

This wasn't planned as a project. It started as a handful of PowerShell scripts in an internal work repo — quick-and-dirty automation to stop me from clicking through the Forgejo UI ten times a day.

While writing those scripts, I stumbled onto something useful: Forgejo's web UI embeds structured JSON directly in `data-*` HTML attributes. The run list page has `data-initial-post-response` with all the job data. The artifacts page has `data-initial-artifacts-response`. No JavaScript rendering, no DOM parsing — just fetch the HTML and pull the JSON out of an attribute.

The scripts worked well enough. But over time, extending them meant fighting PowerShell more than solving the actual problem. Time for a rewrite.

## The Rewrite: Augment, Don't Replace

The Rust rewrite had one guiding principle: **be a companion to `fj`, not a competitor**. The name says it — `fj-ex`, Forgejo CLI *Extension*.

That meant matching `fj`'s conventions exactly. Same `--host/-H`, `--repo/-r`, `--remote/-R` flags. Same git-remote inference logic. Same subcommand patterns. If you know `fj`, you already know `fj-ex`. The muscle memory transfers.

## The Core Trick: The Web UI *Is* the API

Since Forgejo's REST API doesn't cover Actions properly, `fj-ex` talks to the web UI directly — making the same HTTP requests your browser would:

```
GET  /{repo}/actions?page=P&limit=L&list_inner=true    → runs list
GET  /{repo}/actions/runs/{N}                           → run details (JSON in HTML)
GET  /{repo}/actions/runs/{N}/jobs/{J}/attempt/{A}/logs → raw log download
GET  /{repo}/actions/runs/{N}/artifacts                 → artifact list (JSON)
POST /{repo}/actions/runs/{N}/cancel                    → cancel run
POST /{repo}/actions/runs/{N}/rerun                     → rerun
```

The responses either return JSON directly or embed it in `data-*` attributes. A bit of regex extraction and HTML entity decoding is all it takes — no headless browser, no DOM parser.

For mutating operations (cancel, rerun), `fj-ex` extracts the CSRF token from the page first, just like a browser submitting a form.

## The Login Dance

Authentication is where it gets interesting. Since there's no API token mechanism for these endpoints, `fj-ex` logs in the way a human would:

1. Fetch the login page, extract the CSRF token from the form
2. POST username + password + CSRF
3. Store the session cookies
4. On any subsequent request that redirects back to `/user/login`, automatically re-authenticate

Yes, this means storing credentials in plaintext. That's a conscious tradeoff — there's no way around it when you need to re-authenticate automatically against a login form. The README is upfront about it.

## What You Get

With `fj-ex` installed, your CI workflow goes from "open browser, navigate, click, wait, download" to:

```bash
# List recent runs
fj-ex actions runs

# Download logs for a specific job
fj-ex actions logs job 42

# Grab all artifacts from a run
fj-ex actions artifacts download 15

# Cancel a stuck run
fj-ex actions cancel 15

# Rerun a failed workflow
fj-ex actions rerun 15
```

All from the terminal, all respecting the same repo-targeting flags as `fj`.

## The Uncomfortable Truth About Scraping

Building on top of a web UI isn't elegant. It's fragile by nature — any change to Forgejo's HTML structure could break things. But the alternative was to either contribute the missing API endpoints upstream (a much larger effort) or keep clicking through the UI manually.

Sometimes the pragmatic solution is the right one. `fj-ex` fills a real gap today, and if Forgejo eventually exposes these features through proper API endpoints, migrating away from the scraping approach will be straightforward.

The tool is [available on crates.io](https://crates.io/crates/forgejo-cli-ex) with pre-built binaries for Linux, Windows, and macOS.
