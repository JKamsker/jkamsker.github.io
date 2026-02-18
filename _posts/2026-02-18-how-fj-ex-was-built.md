---
layout: post
title: "Forgejo's CLI Doesn't Offer a Way to See Build Details? Fine, I Do It Myself Then"
summary: My AI agents need hands and feet to do CI/CD for me. GitHub's CLI gives them that. Forgejo's doesn't. So I built what was missing.
author: jkamsker
date: '2026-02-18 12:00:00 +0000'
category: devlog
thumbnail: /assets/img/posts/code.jpg
keywords: rust, forgejo, cli, forgejo-actions, ci-cd, web-scraping, developer-tools, ai-agents
tags: [rust, cli, devops]
permalink: /blog/how-fj-ex-was-built/
---

## A Confession and a Problem

I'll be honest: I'm not great at CI/CD. I don't enjoy writing pipeline configs, I don't enjoy debugging them, and I *especially* don't enjoy staring at log output trying to figure out why a build that worked yesterday decided to have feelings today.

So I do what any (un)reasonable developer in 2026 does — I let AI agents handle it. They write the workflows, they iterate on failures, they fix the weird YAML indentation issues. I review the results. It's a great arrangement.

This works beautifully on GitHub, because `gh` — GitHub's CLI — covers *everything*. Runs, logs, artifacts, cancellations, reruns. An AI agent with access to `gh` can see what's happening, read the logs, download artifacts, retry failures, all without ever touching a browser. It has hands and feet. It can walk around and get things done.

Then my company started migrating to self-hosted platforms. Forgejo, specifically — open source, lightweight, GitHub-compatible Actions. Great choice for a lot of reasons.

One problem: the moment we moved, my AI agents lost their legs.

## The Gap

[Forgejo CLI (`fj`)](https://codeberg.org/forgejo-contrib/forgejo-cli/) is solid. Repos, issues, PRs, releases — all there, all from the terminal. It's the `gh` equivalent, and for the things it covers, it covers them well.

But **Forgejo Actions**? Complete blind spot. The API simply doesn't expose them. No run listing, no log downloads, no artifacts, no cancel, no rerun. These features exist exclusively behind the web UI.

For a human, that's annoying. You alt-tab, you click around, you cope.

For an AI agent? It's a brick wall. Agents don't have browsers. They have terminals and CLI tools. If there's no command for it, it doesn't exist. My agents went from autonomously managing the full CI/CD lifecycle on GitHub to being completely helpless the moment a build failed on Forgejo.

I was back to manually debugging pipelines. The one thing I was specifically trying to *not do*.

## What I Needed

The dream was simple — give my agents (and myself, when I'm feeling brave) the same experience `gh` provides:

```bash
# What's happening?
fj-ex actions runs

# Why did it break?
fj-ex actions logs job 42

# Grab the build output
fj-ex actions artifacts download 15

# This run is stuck, kill it
fj-ex actions cancel 15

# Try again
fj-ex actions rerun 15
```

Terminal. One line. Done. Something an agent can call, parse the output of, and reason about.

And it had to feel like `fj`. Same `--host/-H`, `--repo/-r`, `--remote/-R` flags. Same git-remote inference. Same subcommand style. Not a fork, not a replacement — a companion. Hence the name: `fj-ex`, Forgejo CLI *Extension*.

## How I Got There (The Short Version)

It started as a few PowerShell scripts. Just enough to stop the bleeding while we migrated repos. While hacking those together, I found the detail that made this whole project viable: Forgejo's web UI embeds structured JSON directly in `data-*` HTML attributes. Run data sits in `data-initial-post-response`. Artifacts in `data-initial-artifacts-response`. It's just *right there* — no headless browser needed, no DOM parsing. Fetch the page, pull the attribute, parse the JSON.

The scripts worked until I wanted one more feature and realized I was fighting PowerShell harder than the actual problem. So I rewrote it in Rust. Because of course I did.

`fj-ex` essentially pretends to be a browser. Same HTTP requests, same cookie-based auth, same CSRF token dance for mutations like cancel and rerun. Since there's no API token for any of this, it logs in the human way — username, password, stash the session cookies. Is storing credentials ideal? No. Is there an alternative when you're authenticating against a login form that doesn't support tokens? Also no. The README doesn't hide this.

## What It Actually Feels Like

Here's why this matters beyond the technical trick: an AI agent with `fj-ex` installed can now do the full loop.

Build fails → agent runs `fj-ex actions runs` to see what happened → reads the logs with `fj-ex actions logs job <id>` → figures out the issue → pushes a fix → monitors the rerun. All autonomously. All in the terminal. No human required to go click around in a web UI on the agent's behalf.

And for the times I *do* look at CI/CD myself, it's just... nicer. Logs are text in my terminal. I can pipe them into `grep`, `rg`, `less`, whatever. Artifacts download to my current directory. Switching repos is a `-r` flag away. The whole thing gets out of the way and lets me get back to the part of my job I actually enjoy.

## Is This Cursed? A Little.

Building a CLI on top of web scraping is not the noble path. If Forgejo changes their HTML structure tomorrow, things break. That's the deal.

But the alternative was either contributing the missing API endpoints upstream — a much larger undertaking, and one I'd still welcome — or telling my agents "sorry, you're on your own" every time a Forgejo build fails. I chose the pragmatic option.

And if Forgejo *does* add proper API support for Actions someday? Great. The commands stay the same, only the plumbing changes. Migrating away from scraping would be the happiest refactor I've ever done.

## Go Get It

`fj-ex` is [on crates.io](https://crates.io/crates/forgejo-cli-ex), [on GitHub](https://github.com/JKamsker/forgejo-cli-ex), and (of course) [CodeBerg](https://codeberg.org/JKamsker/forgejo-cli-ex) with pre-built binaries for Linux, Windows, and macOS.

My agents have their legs back. My Forgejo tabs are closed. And I'm back to doing what I do best — reviewing the work someone else did.

No more alt-tabbing. Not for me, and not for my agents.