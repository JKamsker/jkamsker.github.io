---
layout: post
title: "How fj-ex Was Built"
summary: Building a Rust CLI extension for Forgejo Actions by scraping the web UI when the API falls short.
author: jkamsker
date: '2026-02-18 12:00:00 +0000'
category: devlog
thumbnail: /assets/img/posts/code.jpg
keywords: rust, forgejo, cli, forgejo-actions, ci-cd, web-scraping, developer-tools
tags: [rust, cli, devops]
permalink: /blog/how-fj-ex-was-built/
---

## The Problem

The [Forgejo CLI (`fj`)](https://codeberg.org/forgejo-contrib/forgejo-cli/) is a Rust-based CLI client for Forgejo — think `gh` for GitHub, but for Forgejo instances. It covers repos, issues, PRs, releases, wikis, tags, orgs, and more, all through Forgejo's REST API.

But there's a gap: **Forgejo Actions**. While `fj` can list tasks, manage variables/secrets, and dispatch workflows, it can't do what you actually need day-to-day: download full job logs, grab artifacts, cancel runs, or rerun failed jobs. These features simply aren't exposed (or aren't fully exposed) through the Forgejo API — they only exist in the web UI.

## Phase 1: PowerShell Scripts in `pandocs`

This didn't start as a prototype. It started as a set of PowerShell scripts living in `Scripts/Forgejo` inside the `pandocs` project (a work repo), built to automate day-to-day workflow — downloading logs, grabbing artifacts, cancelling and rerunning jobs. Practical tools to fill gaps that `fj` didn't cover.

Along the way, the scripts discovered that Forgejo's web UI embeds structured data in `data-*` HTML attributes (like `data-initial-post-response` for job lists, `data-initial-artifacts-response` for artifacts). You don't need a full browser or DOM parser — regex extraction on these well-structured attributes is enough.

The credential store format (`ui-creds.json` in `%APPDATA%\Cyborus\forgejo-cli\data\`) was established here and carried forward.

## Phase 2: Moving to Rust — PowerShell Was Holding It Back

Over time, PowerShell became the bottleneck. The scripts worked, but extending them further meant fighting the language more than solving the actual problem. The decision to rewrite in Rust wasn't about making a "proper" version of a prototype — it was about removing the friction that PowerShell introduced so the tooling could keep growing.

The PowerShell scripts were removed in commit `56e3f51` once the Rust CLI replaced them.

The rewrite was deliberate about one thing: **augment, don't replace**. The name `fj-ex` (Forgejo CLI Extension) signals that it's a companion to `fj`, not a fork. The CLI surface was designed to feel familiar to `fj` users:

- Same `--host/-H`, `--repo/-r`, `--remote/-R` target flags
- Same git-remote inference logic (read the current repo's remotes, fall back to `FJ_FALLBACK_HOST`)
- Same `auth` subcommand grouping pattern
- Subcommand hierarchy: `fj-ex actions runs`, `fj-ex actions logs job`, etc.

### Development Progression (from git history)

The build-up was methodical, one layer at a time:

| Commit | What was built |
|--------|---------------|
| `6fa88f4` | Repo scaffolding |
| `de0784e` | CLI skeleton with clap derive |
| `823b8f7` | Target resolution (git remote inference, `RepoArg` parsing, SSH URL support) |
| `498a1a5` | Credential store (`ui-creds.json` — same format as the PowerShell PoC) |
| `ba42fec` | HTML helpers (CSRF extraction, `data-*` attribute parsing) |
| `6362f4b` | `UiSession` — the HTTP client with cookie jar, auto-relogin on redirect |
| `d162d20` | List workflows/runs via UI endpoints |
| `7496c1b` | Log downloading (per-job and per-run) |
| `fe59aaf` | Artifact listing and downloading |
| `b70f39c` | Cancel and rerun (with `--dry-run` safety) |
| `34d72bf` | Smoke test command |
| `1544b76` | Login command |
| `4be29a8`–`f4a749c` | Full `auth` subcommand group (status, list, show, logout, clear-cookies) |
| `b12f37c` | GitHub Actions CI/CD + release pipeline |
| `4c46b4e` | Renamed crate to `forgejo-cli-ex` for crates.io |

### The "UI API" Approach

The core trick: Forgejo's web UI is the API. `fj-ex` makes the same HTTP requests a browser would:

```
GET  /{repo}/actions?page=P&limit=L&list_inner=true    → workflows/runs
GET  /{repo}/actions/runs/{N}                           → run view (HTML with embedded JSON)
GET  /{repo}/actions/runs/{N}/jobs/{J}/attempt/{A}/logs → raw log download
GET  /{repo}/actions/runs/{N}/artifacts                 → artifact list (JSON)
POST /{repo}/actions/runs/{N}/cancel                    → cancel (with CSRF)
POST /{repo}/actions/runs/{N}/rerun                     → rerun (with CSRF)
```

The HTML responses embed JSON in `data-*` attributes, so parsing is lightweight — regex + `html-escape` for entity decoding, no DOM parser needed.

### Session Management

`UiSession` handles the login dance:
1. GET the login page, extract the CSRF token from the form
2. POST username + password + CSRF token
3. Persist the resulting cookies to `ui-creds.json`
4. On subsequent requests, detect redirect to `/user/login` → auto-relogin using stored plaintext creds

Plaintext credential storage is a deliberate tradeoff: it's required for the auto-relogin flow. The README is upfront about this.

## Architecture

11 source files, clean separation:

```
src/
├── main.rs         → Entry point, command dispatch
├── cli.rs          → clap definitions (commands, args, subcommands)
├── target.rs       → Host/repo resolution from flags, git remotes, env vars
├── store.rs        → Credential store (JSON read/write, migration, repair)
├── session.rs      → UiSession (HTTP client, cookie jar, login, auto-relogin)
├── html.rs         → HTML attribute extraction, CSRF parsing
├── login.rs        → Credential prompting (interactive, stdin, env vars)
├── auth.rs         → Auth subcommand handlers
├── actions.rs      → Actions command router
├── ui_actions.rs   → The actual UI endpoint calls (workflows, runs, jobs, logs, artifacts)
└── smoke_test.rs   → End-to-end validation sequence
```

**Tech stack:** Rust 2021, tokio async runtime, reqwest (rustls TLS), clap derive, git2 for remote inspection, serde for JSON, eyre for error handling.

## What Makes It Different From `fj`

| | `fj` | `fj-ex` |
|---|---|---|
| **Interface** | Forgejo REST API | Web UI endpoints ("UI API") |
| **Scope** | Full Forgejo coverage (repos, issues, PRs, releases, wiki, orgs…) | Actions only (logs, artifacts, cancel, rerun) |
| **Auth** | OAuth / app tokens | Plaintext UI credentials + cookies |
| **Relationship** | Standalone | Companion — same flag conventions, complements `fj` |

The two tools coexist: `fj` for everything the API supports, `fj-ex` for the Actions features that only the web UI exposes. Same `--host/-H`, `--repo/-r`, `--remote/-R` muscle memory applies to both.

## Release Pipeline

CI auto-publishes to crates.io on push to `master`, with automatic patch version bumping if the current version already exists. A separate release workflow builds cross-platform binaries (Linux x86_64, Windows x86_64, macOS aarch64) on tag push and uploads them to GitHub Releases.
