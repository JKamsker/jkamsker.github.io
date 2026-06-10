---
layout: post
title: "We Left GitHub for Forgejo. The IDE Plugin Didn't Come With Us. So I Built One."
summary: My company moved off GitHub onto self-hosted Forgejo. The migration was clean; what broke was code review. JetBrains ships a pull-request tool window for GitHub and nothing equivalent for Forgejo, so for three months we did reviews in a browser. This is the plugin I built to stop doing that.
author: jkamsker
date: '2026-05-20 12:00:00 +0200'
category: devlog
thumbnail: /assets/img/posts/forgejo-rider-2.webp
keywords: forgejo, rider, jetbrains, intellij idea, pycharm, webstorm, phpstorm, goland, clion, rubymine, rustrover, datagrip, dataspell, android studio, mps, plugin, pull-requests, code-review, self-hosted, gitea
tags: [forgejo, jetbrains, devops, rider, intellij]
permalink: /blog/forgejo-rider-plugin/
faq:
  - q: "Why not just keep using the browser?"
    a: "I tried. For three months. The alt-tab tax is real, and code review in a browser isn't what an IDE is for."
  - q: "Why not contribute the change to JetBrains' bundled GitHub plugin?"
    a: "The bundled plugin is GitHub-specific from the type system up - there's no generic Git-host layer to slot a Forgejo backend into. Building separately was always going to be cleaner than retrofitting one."
  - q: "Is this on the JetBrains Marketplace?"
    a: "Yes - [plugins.jetbrains.com/plugin/31556-forgejo](https://plugins.jetbrains.com/plugin/31556-forgejo). It's a paid, closed-source plugin."
  - q: "Does it work with Codeberg or Gitea?"
    a: "Codeberg is Forgejo, so yes. Gitea probably works for the REST endpoints; the web-session paths are Forgejo-shaped and may need adjustment."
---

> **TL;DR:** My company moved off GitHub to self-hosted Forgejo. The migration went fine. The Rider code-review workflow didn't survive it. So I built the Forgejo plugin nobody else was shipping.

## Off GitHub

A few months ago my company moved our codebase off GitHub onto a self-hosted Forgejo instance.

The reasons were the usual ones for 2026. The outages weren't even the worst of it - what we actually didn't want was our source code living inside a US-hosted service that answers to a political climate we don't get a vote in. So we picked Forgejo, stood up an instance, pushed everything, and migrated.

The migration worked. Push, pull, branch, merge from the command line - all fine. Web UI for browsing - fine.

What broke was the IDE side.

Before we left, code review happened inside Rider. There's a pull-request tool window built into the IDE: list of open PRs, click one, the diff opens inline, you comment on a line, reply to a teammate, hit merge. JetBrains ships that for GitHub. They don't ship it for anything else.

The day we left GitHub, that tool window stopped being useful. For three months, doing a code review meant alt-tabbing to a browser, finding the PR, writing comments in a web textarea, switching back to write the follow-up code, alt-tabbing again. Multiplied across a team that does real review every day, it stopped being a small thing.

That's the part where the brain goblin started taking notes.

## The Gap

I assumed someone had solved this. Forgejo isn't obscure - Codeberg runs on it, half the self-hosted community uses it, and Gitea (the project it forked from) is older still. Surely there was a JetBrains plugin.

There wasn't. A few abandoned attempts on the Marketplace for Gitea, nothing maintained, nothing for Forgejo at all.

JetBrains' GitHub support isn't generic. The plugin is GitHub-specific from the type system up - the data classes assume GitHub's API, the authentication goes through GitHub's OAuth flow, the URL handling assumes github.com paths. You can't point it at a Forgejo server. There's no setting for that, and the code wouldn't know what to do with the response if you did.

What you can do is take the bundled plugin's source as a structural reference, throw out everything GitHub-specific, and rebuild the same shape against Forgejo's API.

So I did.

## What it does

If you've used Rider's GitHub tool window, you already know how this one works. Same surface, against Forgejo:

- **Pull requests.** List open and closed PRs, filter by author, label, state. Open a PR as a tab inside the IDE - title, body, branches, commits, changed files, assignees, reviewers, CI status, mergeability.
- **Review.** The diff opens in Rider's normal diff viewer. Comment on lines, reply, react with emoji, mark files as viewed. Submit your review as approve, comment, or request changes. Suggested changes can be applied locally with a click.
- **Merge.** Merge, squash, or rebase - whichever methods your Forgejo repo allows. Delete the source branch on merge when the repo is configured for it.
- **Clone.** Add a Forgejo account with a personal access token, then clone any repo you have access to from the IDE's clone dialog. HTTPS auth is wired through automatically; the IDE picks up the right account when you push or pull.
- **Forgejo Actions.** A second tab in the Forgejo tool window: workflows, runs, jobs, logs, artifacts, cancel, rerun. The same surface the web UI gives you, in the IDE, where you're already standing.

I've been daily-driving this for a few months. I do my code reviews in Rider again. I haven't opened the Forgejo web UI for a PR in weeks.

## What it is, and isn't

**It's paid, closed source, and one person.** I built this because we needed it. It's on the JetBrains Marketplace as a commercial plugin - that's what funds keeping it current against Rider 2026.1+ and the moving target of Forgejo's `next` release. There's no public repo. If you evaluate tools by reading their source, this won't satisfy that.

**It scrapes the web UI for the Forgejo Actions tab.** Forgejo's official API doesn't yet expose runs, logs, artifacts, cancel, or rerun. So the plugin logs into your Forgejo instance the same way your browser does - username and password, stored through your IDE's secure credential vault (the same one that holds your Git passwords) - and reads the data from the web routes. The pact, in the words of [`fj-ex`](https://github.com/JKamsker/forgejo-cli-ex) which solved the same problem from the terminal side last year: I scrape, they ship, I pray. The day Forgejo exposes proper API endpoints for Actions, the plugin switches over with no user-visible change.

**Inline review threads are partially landed.** Submitting reviews works. Inline comments in the diff viewer work, with replies and reactions. The native editor *gutter inlay* polish - the kind of thing where the gutter icon in your editor opens the thread popup directly - is in progress. If you do your reviews in the dedicated diff view, you won't notice. If you live in the editor itself, you will.

**OAuth isn't done yet.** Authentication is personal access tokens. Forgejo's OAuth provider exists, but its docs say [OAuth scopes aren't implemented](https://forgejo.org/docs/next/user/oauth2-provider/), so PAT is the practical option today. OAuth lands when Forgejo's does.

**Thirteen JetBrains IDEs, one daily driver.** The plugin works in Android Studio, CLion, DataGrip, DataSpell, GoLand, IntelliJ IDEA, MPS, PhpStorm, PyCharm, Rider, RubyMine, RustRover, and WebStorm. I'm a .NET developer, so my daily driver is Rider. The other twelve are tested through JetBrains' plugin verifier, but reports from anyone using them in anger are welcome.

## Installing

It's on the JetBrains Marketplace: <https://plugins.jetbrains.com/plugin/31556-forgejo>.

From inside any of the supported IDEs: `Settings → Plugins → Marketplace`, search for "Forgejo", install. No restart needed - the plugin is dynamic-load-clean.

Then `Settings → Version Control → Forgejo`. Add your server URL (`https://codeberg.org`, or whatever your self-hosted instance is) and a personal access token. Forgejo generates tokens under `Settings → Applications → Generate New Token` in its own web UI. Hit `Test Connection`. If the token works, the PR tool window starts populating itself.

## What's next

In rough order of how much I want them:

1. Native editor gutter inlay for review threads, to close the last gap with JetBrains' GitHub plugin.
2. OAuth2 with PKCE, the day Forgejo's OAuth scopes land.
3. A push-notification "create PR" prompt after you push a feature branch.
4. Pushing from inside the Share Project flow - today it creates the repo and hands you the remote-setup commands.

If your company is sitting on a Forgejo migration and the IDE story is what's holding it up - this is the part where it stops holding it up.

Marketplace listing: <https://plugins.jetbrains.com/plugin/31556-forgejo>. Bug reports, feature requests, and reviews go through the plugin page.