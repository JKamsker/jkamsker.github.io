---
layout: post
title: "JetBrains Ships a GitHub Plugin. Nobody Ships a Forgejo One. So I Built It."
summary: We moved the company off GitHub onto self-hosted Forgejo. Suddenly the PR workflow in Rider was alt-tab and a browser tab. So I carved the GitHub plugin's shape out of the bundled Rider code and rebuilt it against Forgejo's REST API. It's been my daily PR tool for a few months now.
author: jkamsker
date: '2026-05-20 12:00:00 +0200'
category: devlog
thumbnail: /assets/img/posts/forgejo-rider-plugin.webp
keywords: forgejo, rider, jetbrains, intellij idea, pycharm, webstorm, phpstorm, goland, clion, rubymine, rustrover, datagrip, dataspell, android studio, mps, plugin, pull-requests, code-review, self-hosted, gitea
tags: [forgejo, jetbrains, devops, rider, intellij]
permalink: /blog/forgejo-on-jetbrains-ides/
faq:
  - q: "Why not just use the browser?"
    a: "I tried. For three months. The alt-tab tax is real, and code review in a browser is not what Rider is for."
  - q: "Why not contribute to the bundled JetBrains GitHub plugin?"
    a: "It's GitHub-specific top to bottom - IDs, OAuth flow, GraphQL DTOs, the VFS key. Forking shape was always going to be cleaner than retrofitting a generic Git-host abstraction."
  - q: "Is this on the JetBrains Marketplace?"
    a: "Yes - [plugins.jetbrains.com/plugin/31556-forgejo](https://plugins.jetbrains.com/plugin/31556-forgejo). It's a paid plugin, closed source."
  - q: "Does it work with Codeberg / Gitea?"
    a: "Codeberg should work, it's Forgejo. Gitea probably works too for the REST endpoints we hit; the web-session paths are Forgejo-shaped and may need adjustment."
---

> **TL;DR:** My company moved off GitHub to self-hosted Forgejo. JetBrains ships a GitHub plugin, not a Forgejo one. So I built `forgejo-rider-2` - pull request list, review, merge, clone, and a Forgejo Actions tab, all from inside Rider. It's been my daily PR tool for a few months now.

## Off GitHub

My company decided to stop running our source code through a US-hosted service that goes down sometimes and answers to a political climate we don't get a vote in. The GitHub outages weren't the headline - the headline was "if this gets weird, do we want our codebase living there?" We didn't.

So we picked Forgejo, stood up an instance, and migrated.

The day-to-day was fine for a while. Push, pull, browse files in the web UI, do the occasional review through the browser. Tolerable. Familiar.

What I missed was Rider's PR workflow. That little tool window where you pick a PR, see the diff inline, comment on a line, hit merge, close the tab. JetBrains ships [GitHub support](https://www.jetbrains.com/help/rider/Work_with_GitHub_pull_requests.html) bundled into Rider - it's been there for years, it's good, and we'd been using it daily without thinking about it.

The moment we left GitHub, that tool window stopped being useful. Three months of alt-tabbing to a browser to do code review, and the brain goblin started taking notes.

## The Gap

JetBrains ships GitHub support. There's no Gitea plugin either, despite a few abandoned attempts on the Marketplace. The bundled GitHub plugin is a closed shape - it depends on `org.jetbrains.plugins.github`, it owns the `ghpr` VFS key, it has GitHub OAuth wired into JetBrains' own OAuth service, and most of the PR data flow is GitHub GraphQL queries with GitHub node IDs.

You can't just point it at a different host. The "host" is hardcoded into the type system.

What you can do is take the bundled plugin's source as a reference, throw out everything GitHub-specific, and rebuild the same shape against a different API. That's `forgejo-rider-2`.

## What it does

Same surface as Rider's GitHub support, against Forgejo:

- **Account + clone.** Add a Forgejo account with a personal access token. Test connection. Clone dialog with repo search across your account's user and org repos. The clone URL comes from Forgejo's `clone_url`/`ssh_url` when available, with a generated fallback for older instances.
- **PR tool window.** List PRs with state/author/label filters, paged through Forgejo's `Link` headers. Open a PR as an editor tab. Title, body, branches, commits, changed files, mergeability, conflicts, labels, assignees, reviewers, draft state (Forgejo's `WIP: ` title convention).
- **Diff and review.** Show changed files. Open the diff in Rider's normal diff viewer. Inline review threads, replies, edit/delete comments, reactions. Submit review as approve / comment / request changes. Apply suggested changes locally. The "viewed" state on files syncs back through the Forgejo web session.
- **PR actions.** Close, reopen, merge (merge, squash, rebase - whatever the repo allows), delete branch on merge when supported.
- **Git integration.** Repository hosting service so the right account is picked up for HTTPS auth (PAT as the password - Forgejo's standard pattern). Current-branch PR presenter in the branches popup. Open/copy PR link from the editor. Protected-branch awareness refreshed after fetch.
- **Forgejo Actions.** A second tab in the Forgejo tool window. Workflows, runs, jobs, logs (streamed from the same endpoints `fj-ex` hits - yes, the web routes), artifacts, cancel, rerun, rerun-failed, dispatch with inputs, runner tokens, queued job visibility.
- **Share to Forgejo.** Create a repo for the current project under your user or an org. The PoC creates the repo and gives you the remote setup commands; pushing from inside the IDE is on the list.

If you've used the bundled GitHub plugin, you already know how this one works.

## How it's wired

The bundled GitHub plugin is REST plus a lot of GraphQL - PR search, review threads, mergeability, viewed-file state, the works. Forgejo is REST-first, OpenAPI-documented at `/api/swagger`. So the port was mostly unhooking GraphQL DTOs and replacing them with REST DTOs. The GitHub plugin's GraphQL model did not enjoy being asked to be a REST model, and a lot of the work was talking it down.

The REST surface looks roughly like you'd expect:

```text
GET    /api/v1/user
GET    /api/v1/repos/{owner}/{repo}/pulls?state=open&page=1&limit=50
GET    /api/v1/repos/{owner}/{repo}/pulls/{index}
GET    /api/v1/repos/{owner}/{repo}/pulls/{index}/files
POST   /api/v1/repos/{owner}/{repo}/pulls/{index}/reviews
POST   /api/v1/repos/{owner}/{repo}/pulls/{index}/merge
```

Authorization is `token <PAT>`. Pagination is `page`/`limit` with `Link` and `X-Total-Count` headers - same shape as GitHub, different spellings.

Two things Forgejo's REST API doesn't (yet) expose cleanly:

1. **Actions runs, logs, artifacts, cancel, rerun.** Same problem [`fj-ex`](https://github.com/JKamsker/forgejo-cli-ex) ran into last year. The data is in the web UI; the API doesn't have it. The plugin uses a native Kotlin Forgejo *web session* - cookies, CSRF, the works - to call the same routes the browser does. Login is username + password against Forgejo's web form, stored through PasswordSafe. Is this ideal? No. Is there an alternative for Actions in 2026? Also no.
2. **A few PR-side niceties** like viewed-file sync and thread resolve/unresolve. Same web-session path. Same caveat.

So the plugin's API client is two layers: REST against `/api/v1` for everything Forgejo exposes properly, and a web-session client for the things it doesn't. Each call site checks the connected instance's `/api/v1/version` and `/swagger.v1.json` and disables features that the target Forgejo doesn't have, rather than crashing the tool window.

On the Rider side, this is a standard IntelliJ Platform Gradle Plugin 2.x project targeting Rider 2026.1+. The `plugin.xml` depends on `Git4Idea`, the IntelliJ collaboration tools, and the bundled VCS modules:

```kotlin
intellijPlatform {
    rider("2026.1")
    bundledPlugin("Git4Idea")
    bundledPlugin("com.intellij.tasks")
    bundledModule("intellij.platform.collaborationTools")
    bundledModule("intellij.platform.collaborationTools.auth")
    bundledModule("intellij.platform.vcs.dvcs")
    // …vcs.dvcs.impl, vcs.impl, vcs.log, etc.
}
```

It's a dynamic plugin - installs and unloads without restarting Rider - and `verifyPlugin` runs against Rider and Android Studio in CI.

## Where it bites

**Line-level review threads are partially landed.** Submit review (approve / comment / request changes) works. Inline threads in the editor work, with replies and reactions, and you can resolve/unresolve through the web session. The native editor *gutter inlay* polish - the kind of thing GitHub's plugin has where the gutter icon opens the thread popup directly - is in progress, not finished. If you do all your reviews in the dedicated diff view, you won't notice. If you live in the editor itself, you will.

**OAuth isn't done.** Authentication is personal access tokens against `/users/<you>/settings/applications` on your Forgejo instance. Forgejo's OAuth2 provider exists, but its docs say [OAuth scopes aren't implemented yet](https://forgejo.org/docs/next/user/oauth2-provider/), so PAT is the practical option today. OAuth is on the list when scopes land.

**Actions surfaces depend on the web session.** Workflow runs, logs, artifacts - same pact as `fj-ex`. If Forgejo redesigns the Actions UI in a way that changes the route shape, those tabs will need fixing. The pact: I scrape, they ship, I pray.

**Single-developer commercial software.** Paid, closed source, one maintainer (me). I track Rider 2026.1.x and the Forgejo `next` API. If you need vendor-supported software with a phone number to call when it breaks, this isn't that - it's me, with a financial incentive to keep it working.

**Closed source.** No public repo. If reading other people's plugin code is part of how you evaluate a tool, this won't satisfy that - only the public-facing behavior is observable.

**One plugin, thirteen JetBrains IDEs.** The descriptor declares support for Android Studio, CLion, DataGrip, DataSpell, GoLand, IntelliJ IDEA, MPS, PhpStorm, PyCharm, Rider, RubyMine, RustRover, and WebStorm. I've only daily-driven it in Rider. Reports from other IDEs are welcome.

## Installing

It's on the JetBrains Marketplace: <https://plugins.jetbrains.com/plugin/31556-forgejo>. Works in Android Studio, CLion, DataGrip, DataSpell, GoLand, IntelliJ IDEA, MPS, PhpStorm, PyCharm, Rider, RubyMine, RustRover, and WebStorm.

From inside any of those IDEs: `Settings → Plugins → Marketplace`, search for "Forgejo", install. The plugin is dynamic-load-clean, so no restart is required.

After install: `Settings → Version Control → Forgejo`. Add your server URL (e.g. `https://codeberg.org` or your self-hosted instance) and a personal access token - generate one inside Forgejo under `Settings → Applications → Generate New Token`. Hit `Test Connection`. If the token works, the PR tool window starts populating itself.

## What's not in this post

The dynamic-plugin-reload story - making the plugin survive an in-place update in a running Rider - was its own multi-week side quest. Tool window listeners, custom editor tabs, diff virtual files, all need explicit disposal or the classloader pins itself and unload silently fails. That's a whole separate post.

The Forgejo migration itself - how we moved repos, CI configs, secrets - also belongs in its own writeup. This one is about the IDE side.

## What's next

In order of how much I want each of them:

1. Native editor gutter inlay for review threads, to close the gap with GitHub's plugin.
2. OAuth2 with PKCE, the day Forgejo's OAuth scopes land in a release.
3. Push-notification "create PR" prompt after a Git push.
4. Push-from-IDE inside the Share Project flow - today it creates the repo and hands you the remote-setup commands.

Marketplace listing: <https://plugins.jetbrains.com/plugin/31556-forgejo>. Bug reports, feature requests, and reviews go through the plugin page.

*(P.S.: If your company is sitting on a Forgejo migration and the IDE story is what's stopping you - try it.)*
