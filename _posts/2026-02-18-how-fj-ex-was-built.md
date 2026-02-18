---
layout: post
title: "Forgejo's CLI Can't Show Build Details? Fine. I'll Do It Myself."
summary: My AI agents need hands and feet to do CI/CD for me. GitHub's CLI gives them that. Forgejo's doesn't. So I built what was missing.
author: jkamsker
date: '2026-02-18 12:00:00 +0000'
category: devlog
thumbnail: /assets/img/posts/code.jpg
keywords: rust, forgejo, cli, forgejo-actions, ci-cd, web-scraping, developer-tools, ai-agents
tags: [rust, cli, devops]
permalink: /blog/how-fj-ex-was-built/
---

> **TL;DR:** Forgejo Actions has no usable API or CLI surface for runs, logs, or artifacts. I built [`fj-ex`](https://github.com/JKamsker/forgejo-cli-ex), a `fj`-style companion that scrapes the web UI's embedded JSON so humans *and* AI agents can manage CI from the terminal. Yes, it's scraping. No, I don't feel bad about it.

## A Confession and a Problem

I'll be honest: I'm not great at CI/CD. I don't enjoy writing pipeline configs, I don't enjoy debugging them in production, emotionally, and I *especially* don't enjoy playing "spot the difference" between yesterday's green run and today's red run — where the only change is that the build system woke up and chose violence.

If a build breaks at 09:03, I want it fixed by 09:04. Not a 40-minute archaeological dig through logs that read like a toaster having a panic attack.

So I do what any (un)reasonable developer in 2026 does — I let AI agents handle it. They write the workflows, they iterate on failures, they fix the weird YAML indentation issues. I review the results. It's a great arrangement.

This works beautifully on GitHub, because `gh` — GitHub's CLI — covers *everything*. Runs, logs, artifacts, cancellations, reruns. An AI agent with access to `gh` can see what's happening, read the logs, download artifacts, retry failures, all without ever touching a browser. It has hands and feet. It can walk around and get things done.

Then my company started migrating to self-hosted platforms. Forgejo, specifically — open source, lightweight, GitHub-compatible Actions. Great choice for a lot of reasons.

One problem: the moment we moved, my AI agents lost their legs.

## The Gap

[Forgejo CLI (`fj`)](https://codeberg.org/forgejo-contrib/forgejo-cli/) is solid. Repos, issues, PRs, releases — all there, all from the terminal. It's the `gh` equivalent, and for the things it covers, it covers them well.

But **Forgejo Actions**? Nothing. No run listing. No log downloads. No artifacts. No cancel. No rerun. These features exist exclusively behind the web UI.

To put it another way:

What `gh` lets an agent do: list runs, read logs, download artifacts, cancel jobs, rerun failures — never open a browser.

What `fj` lets an agent do: …have you tried clicking?

For a human, that's annoying. You alt-tab, you click around, you lie to yourself that this is fine.

For an AI agent? It's a brick wall. Agents don't have browsers. They have terminals and CLI tools. If there's no command for it, it doesn't exist. My agents went from autonomously managing the full CI/CD lifecycle on GitHub to being completely helpless the moment a build failed on Forgejo. They were a brilliant brain in a jar — with no network adapters.

I was back to manually debugging pipelines. The one thing I was specifically trying to *not do*.

## What I Needed

The dream was simple — give my agents (and myself, when I'm feeling brave) the same experience `gh` provides:

```bash
# What's happening?
fj-ex actions runs

# Let me read the tea leaves
fj-ex actions logs job 42

# Grab the goods
fj-ex actions artifacts download 15

# Nope, kill it
fj-ex actions cancel 15

# Hope springs eternal
fj-ex actions rerun 15
```

Terminal. One line. Done. Something an agent can call, parse the output of, and reason about.

And it had to feel like `fj`. Same `--host/-H`, `--repo/-r`, `--remote/-R` flags. Same git-remote inference. Same subcommand style. Not a fork, not a replacement — a companion. Hence the name: `fj-ex`, Forgejo CLI *Extension*.

I didn't need to build a new brain. I needed to build knees.

## How I Got There

It started as a few PowerShell scripts. Just enough to stop the bleeding while we migrated repos. And while hacking those together, I found the detail that made this whole project viable.

Forgejo's frontend developers — bless their hearts — left the keys in the ignition.

Their web UI embeds structured JSON directly in `data-*` HTML attributes. Run data sits right there in the page markup:

```html
<div id="response-data"
     data-initial-post-response='{"workflow_runs":[{"id":42,"status":"completed","conclusion":"failure",...}]}'
     data-initial-artifacts-response='[{"id":15,"name":"build-output","size":204800,...}]'>
</div>
```

No headless browser needed. No DOM spelunking. Just: fetch the page, yank the attribute, parse the JSON, pretend this was an API all along.

That's not an API… but it *is* data.

The PowerShell scripts worked until I wanted one more feature and realized I was fighting PowerShell harder than the actual problem. My developer ego demanded type safety for what is essentially a glorified `curl` script. So I rewrote it in Rust — not because it was the right choice, but because the only two modes I have are "quick hack" and "mass rewrite in a systems language."

`fj-ex` essentially pretends to be a browser. Same HTTP requests, same cookie-based auth, same CSRF token dance for mutations like cancel and rerun. Since there's no API token for any of this, it logs in the human way — username, password, stash the session cookies. Is storing credentials ideal? No. Is there an alternative when you're authenticating against a login form that doesn't support tokens? Also no. The README doesn't hide this.

## What It Actually Feels Like

Here's why this matters beyond the technical trick: an AI agent with `fj-ex` installed can now do the full loop.

Build fails → agent runs `fj-ex actions runs` to see what happened → reads the logs with `fj-ex actions logs job <id>` → figures out the issue → pushes a fix → monitors the rerun. All autonomously. All in the terminal. No human required to go click around in a web UI on the agent's behalf.

Forgejo handed my agents a beautiful map of the world. I just gave them back their shoes.

And for the times I *do* look at CI/CD myself, it's just... nicer. Logs are text in my terminal. I can pipe them into `grep`, `rg`, `less`, whatever. Artifacts download to my current directory. Switching repos is a `-r` flag away. The whole thing gets out of the way and lets me get back to the part of my job I actually enjoy.

## Is This Cursed? A Little.

```
Cursedness Meter: [███████░░░] 7/10

  ✅ Works today
  ✅ No headless browser required
  ✅ Structured JSON, not regex-over-HTML
  ❌ Scraping behind auth
  ❌ Stored session cookies
  ❌ Will break if Forgejo redesigns
```

On a cursedness scale from "regex to parse HTML" to "running production on SQLite," this lands at "screen-scraping behind auth with stored credentials." So, you know, Tuesday.

But the alternative was either contributing the missing API endpoints upstream — a much larger undertaking, and one I'd still welcome — or telling my agents "sorry, you're on your own" every time a Forgejo build failed. I chose the pragmatic option.

And if Forgejo *does* add proper API support for Actions someday? Great. The commands stay the same, only the plumbing changes. Migrating away from scraping would be the happiest refactor I've ever done.

## FAQ (Half Useful, Half Honest)

**Does this break if Forgejo changes the UI?**
Yes. That's the pact. I scrape, they ship, I pray.

**Is storing session cookies ideal?**
No. But neither is opening a browser in 2026 to check if a build passed.

**Why Rust?**
Because the alternative was maintaining PowerShell, and I've suffered enough.

**Will you replace scraping with a real API later?**
The day Forgejo exposes Actions in the API, I will refactor with mass joy and mass `cargo rm`.

## Go Get It

`fj-ex` is [on crates.io](https://crates.io/crates/forgejo-cli-ex), [on GitHub](https://github.com/JKamsker/forgejo-cli-ex), and (of course) [on Codeberg](https://codeberg.org/JKamsker/forgejo-cli-ex) with pre-built binaries for Linux, Windows, and macOS.

My agents have their legs back. My Forgejo tabs are closed. And I'm back to doing what I do best — reviewing the work someone else did and mass-approving it pretending I understood every change.

And yes, I wrote Rust to avoid clicking a website.