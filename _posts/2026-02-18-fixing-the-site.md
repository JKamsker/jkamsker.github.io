---
layout: post
title: "The Site Is on Fire. Here's Your FTP Password. Good Luck."
summary: A client's legacy SilverStripe site had the CSV export button killing the server, filters that were pure theater, and a statistics page that took minutes to load. The job was just "build a bot to extract the data." My brain goblin had other plans. I'm not even a PHP developer, so I built a CLI toolbox to give my AI agent eyes and legs, pointed it at the fire, and let it work. File by file. Over FTP. In 2026.
author: jkamsker
date: '2026-02-18 12:00:00 +0000'
category: devlog
thumbnail: /assets/img/posts/fixing-the-site.png
keywords: silverstripe, php, legacy, ftp, debugging, cli-tooling, devops, production-firefighting, ai-agents
tags: [php, cli, devops]
permalink: /blog/fixing-the-site/
last_modified_at: '2026-02-19 00:00:00 +0000'
faq:
  - q: "Why didn't you just set up SSH?"
    a: >-
      They gave me SSH after I'd already fixed everything.
      You work with the door they give you, even if that door is FTP.
  - q: "You uploaded a web shell to production?"
    a: >-
      A temporary one for diagnostic purposes, removed afterwards.
      When your only access is FTP and you need to understand the server environment now, you do what the situation demands.
  - q: "Isn't this just a glorified set of `curl` scripts?"
    a: >-
      Yes, but with guardrails, unit tests, structured logging, and documentation.
      That's the difference between a hack and a tool.
  - q: "Why Python for the exporter?"
    a: "Because it needed to exist in an hour, not be beautiful."
  - q: "You wrote unit tests during a production firefight?"
    a: "Yes. For the FTP helpers and the DB read-only guardrails."
  - q: "How much did the AI agent actually do?"
    a: >-
      More than me, honestly. I built the toolbox and guardrails; the agent did the actual SilverStripe archaeology and patches.
      I still had to supervise (and stop it from doing unsafe things), but it carried most of the debugging load.
  - q: "Why didn't you just stop at the bot?"
    a: "Because the brain goblin doesn't negotiate."
  - q: "Will you ever stop being dramatic about FTP?"
    a: "No. It's 2026 and I deployed production fixes by uploading PHP files one at a time."
  - q: "Do you actually enjoy this kind of work?"
    a: "I know what I said. Don't judge me."
---

> **TL;DR:** A client's legacy SilverStripe site had admin filters that were decorative, a statistics page that took minutes to load, and a CSV export button that just killed the server. The paginated dashboard technically worked - it just lied to you. The job was simple: build a bot to extract the data. I did that by lunch. Then my brain goblin wouldn't let it go. I haven't written PHP since the dark ages, but I got FTP access, built a CLI toolbox so my AI agent could see the server, and let it track down the bugs semi-autonomously. Deployed fixes file-by-file over FTP. Yes, FTP. No, I don't want to talk about it.

## A Confession

I'll be honest: I have a thing for dirty code.

Not *my* dirty code - I write pristine, well-architected systems that definitely don't have `// TODO: fix this later` comments from 2019. No, I mean *other people's* dirty code. Legacy systems. The kind of codebase where the README says "just works" and the reality says "just barely." Hand me FTP credentials to a decade-old PHP site that's held together by session variables and sheer institutional denial, and something in my brain lights up like a Christmas tree.

Most developers see a legacy dumpster fire and feel dread. I feel the same thing a cave diver feels staring into a dark hole in the ground: this is going to be awful, I might not come back the same person, and I absolutely cannot wait to go in.

So when a client's legacy SilverStripe site landed on my desk a while back - "not working," they said, which undersells it the way "the Titanic had a minor hull issue" undersells maritime history - I didn't groan. I cracked my knuckles.

The admin filters were decorative - you could select them, the UI would update, and nothing would change. The statistics page took minutes to render. And the CSV export button? That one didn't produce a slow page. It produced a dead server. The people who actually needed this data couldn't get it; the site was a locked filing cabinet that electrocuted you when you touched the handle.

The existing workaround was... creative. Since the export was broken, someone had set up an AI agent to read every outgoing invoice as PDF (which was mirrored to a dedicated email address) - and scrape the numbers out of them to reconstruct the data the admin panel couldn't provide. An AI reading every invoice to reverse-engineer the database. In production.

I'll spare you my exact reaction. What I *said* was "I'll take a look at the site."

The ask was straightforward: build a bot that extracts the data the admin panel can't export, and send the reports to the client. That's it. No fixing the site. No debugging. Just get the data out.

All I had to work with was admin login credentials and the live web UI. No server access. No FTP. No SSH. No deployment pipeline. Just a username, a password, and a website that killed itself the moment you asked it to do anything useful.

The plan was simple: build the bot, get the data flowing, hand it over, walk away.

You can probably guess how that went.

## Build the Bot (The Part They Paid Me For)

First order of business: the client needed order exports *today*, and the export button was one of the things producing 500s. So I needed a workaround that bypassed the broken UI entirely.

I wrote a Python exporter that logs into the admin panel and triggers the same SilverStripe GridField export actions a human would click, except it does it over HTTP, with structured logging, and without crashing. Added redaction to the HTTP logs so cookies and CSRF tokens wouldn't end up in version control, because I've read enough post-mortems to know that's how you get a *second* incident.

Even while the building was on fire, I refactored the exporter into a clean `src/` layout with shared modules and ran `python -m compileall` as a sanity check. Professionalism is a disease - you can't turn it off even when you should.

By mid-afternoon, non-technical team members could trigger exports through a chat slash command and get the CSV back in their messaging client. No admin panel required. No 500s. Just data. The PDF-scraping workaround? Quietly retired.

I also wrapped the exporter in a serverless function and added CI that automatically exports the past month's data on every push and uploads it as an artifact.

Job done. Bot built. Data flowing. Walk away.

I did not walk away.

## The Brain Goblin

The bot worked. The reports were landing. The client was happy. The rational thing was to close the laptop and move on.

But the site was still broken. The admin panel was still 500ing. The filters were still lying. And somewhere in the back of my skull, a small, irresponsible voice was saying: *you could fix this. You know you could fix this. It would be so satisfying to fix this.*

I call this voice the brain goblin. It's the part of my brain that sees a dumpster fire and doesn't think "someone should deal with that" - it thinks "I should deal with that, right now, tonight."

There's a catch, though: I'm not a PHP developer. I *was*, once, in the dark ages - back when `mysql_real_escape_string` was considered security and deploying meant dragging files into FileZilla. But that was a long time ago. I couldn't fix this myself.

But I could build the tools to let an AI agent fix it *for* me.

The agent is a better PHP developer than I am. It can read SilverStripe framework code, trace ORM call chains, spot N+1 patterns, and suggest fixes in a language I haven't seriously written in over a decade. What it *can't* do is see what's happening on a remote server. It can't read logs that live behind FTP. It can't query a database it doesn't have credentials for. It can't upload a patched file.

The agent was a brain in a jar. My job was to build the jar some legs.

I got FTP access. And from there, the plan took shape: build CLI tools that let the agent fetch evidence over FTP, tail logs, query the database, and upload surgical fixes one file at a time. Most of the tooling was done by midnight on day one. I have the commit history to prove it, and the commit messages to prove I was losing it.

## Build the Operating Room

The constraints were, as they say, *chef's kiss*. FTP/FTPS access. No SSH. No deployment pipeline. Changes had to be uploaded file-by-file, like it was 2003 and we were all pretending this was fine. Some requests died before SilverStripe could even log them - Apache would just emit "End of script output before headers," the server equivalent of a shrug, and move on.

But the FTP folders had secrets. MySQL credentials in a config file - that got me database access. FTP alone was painfully slow for exploratory debugging, though. I needed something closer to shell access. So I did what any principled engineer would do: I uploaded a temporary, purpose-built web shell, used it to gather intel on the server environment, and removed it when I was done. Resume material? No. But the only door they gave me was FTP.

So I built a portable CLI toolkit, piece by piece:

**FTP log tailing.** A script that connects over FTPS, downloads the latest log entries, and formats them locally. Because `tail -f` is great when you have SSH. When you have FTP, you improvise.

**Read-only database CLI.** A command-line tool that talks to the remote database, with guardrails - only `SELECT`, `SHOW`, `DESCRIBE`, and `EXPLAIN` are allowed, and it rejects multi-statement queries. I needed the agent to inspect data, not accidentally `DROP TABLE` a client's order history because of a fat-fingered semicolon. Yes, I wrote unit tests for the query guardrails. During the production firefight. Like I said: disease.

**FTP put for file-by-file deploys.** Upload exactly one changed file and nothing else. Verify by re-downloading the remote file and comparing SHA256 hashes - or `git diff --no-index` for the paranoid (me). This became the deployment "pipeline." It's the saddest CI/CD you've ever seen, and it worked perfectly.

The repo stopped being "just an exporter" and became a portable operations toolbox - the agent's nervous system for a site we could only reach by FTP.

## Bring the Site Into Version Control (So You Can Think About It)

You can't reason about code that exists only on a remote server you access via FTP. So I mirrored the entire webroot locally and committed it. A download script using eight parallel FTP connections pulled over a thousand source files - PHP, JS, CSS, templates, configs - with zero failures. For the first time in this site's life, it was in version control.

I told the agent explicitly: source files only. No media. Do not download images.

It downloaded 300 GB of media before my SSD ran out of space.

The agent had decided, with the quiet confidence of a golden retriever carrying a tree branch through a doorway, that "mirror the webroot" meant *mirror the webroot*. Every customer photo. Every generated thumbnail. Every asset uploaded since the mid-2010s. My SSD just tapped out first. We had a conversation about boundaries.

The webroot itself was a geological record of deployment strategies. `website_v1`, `website_v2`, `website_old`, `website_really_old` - all sitting right next to the actual production folder, like roommates who'd stopped acknowledging each other. Thousands of orphaned images in the root directory. A zip export from literally a decade ago that "should have been deleted a few days after generation."

I also started writing structured bug reports as separate markdown files, because by this point I had enough threads going that my brain alone was not a reliable storage medium.

Speaking of error logs: I pulled roughly a year's worth. About two thousand logged error events. Promising. Then I noticed ninety-five percent of them were the same bug on a single endpoint, screaming on repeat like a car alarm nobody disconnects. The actual admin 500s I was hunting? Barely a whisper underneath.

From here, fixes became normal engineering: the agent traces the issue through the codebase, suggests a patch, I review it, commit, upload the changed file, verify by re-downloading and diffing.

Same site. Suddenly legible.

## What Was Actually Broken

Here's where it gets fun. "Fun."

### The Type Filter That Referenced a Ghost Column

The admin orders page had a "Type" dropdown filter. When you selected an option, the UI sent a query parameter like `q[Type]=CouponItemID`. The server-side code obediently tried to filter on a column called `CouponItemID`.

That column didn't exist.

The dropdown values were raw internal identifiers that some past developer had wired directly into the UI - and at some point the schema had changed underneath them. The filter was sending SQL WHERE clauses into the void. The database responded by dying. A reasonable reaction, honestly.

The fix: change the dropdown values to semantic keys and map them to the columns that actually exist. Fifteen minutes of work, once you know where to look. Finding where to look took considerably longer.

### The Filters That Didn't Filter (And the Export That Paid the Price)

This was the big one. Not one bug, but a constellation of failures that all pointed in the same direction: *the database was always loading everything*.

Most of the admin filters were decorative. They looked functional - dropdowns selected, date ranges set, UI updated - but under the hood, the filter state wasn't being applied to the actual query. Every admin page load was hitting the unfiltered dataset. Tens of thousands of orders, every time.

The only thing keeping the paginated view alive was pagination itself: slice results to 50 rows, hand them to PHP, done. Slow, lying, and demoralizing - but survivable. The server stayed up. The page rendered. Admins could at least *see* their orders, even if the filters were theater.

But even the paginated view was lying. `result.count()` was still counting the entire unfiltered dataset on every load. The UI would show "1–50 of 19,550" regardless of what you'd filtered to, because the count didn't know about the filter either.

Then someone clicked "Export as CSV."

That button was the kill switch. SilverStripe's GridField export does one thing the paginated view never did: it removes pagination. All of it. When the filters work, that's fine - you're exporting a bounded dataset. When the filters are broken and "the entire result set" means *every order ever taken*, combined with summary fields that traverse ORM relationships per row - classic N+1 - you get a request that churns through tens of thousands of rows, firing relationship queries for each one, until PHP runs out of either time or memory. The paginated dashboard could limp along; the export button just killed the server outright. Apache would return a raw error before SilverStripe's error handler even woke up.

The fix came in three layers. **Mitigation:** default to a bounded date range when no explicit filters are set, because exporting the entire history of a company in one HTTP request is not a feature, it's a dare. **Correctness:** make the export action carry the current filter state, which required changes in both the GridField JavaScript and the server-side code. **Performance:** override the export columns to skip expensive per-row relationship traversals.

### Date Filters That Filtered on the Wrong Date

The admin date presets - "Last 7 days," "Last 3 months," "Today" - were filtering on the wrong timestamp column. The paginator count didn't reflect the filtered list. Filter state wasn't persisted across page loads.

That last one had a framework-specific root cause: in SilverStripe's GridField, data manipulators apply in component order. The date filter was running *after* the paginator, so the paginator computed totals against the unfiltered list. The UI would show all results regardless of the date range. Later pages were empty. The admin panel was gaslighting its own users.

Multiple fixes: correct the timestamp column, fix the preset logic, insert the date filter component *before* the paginator, and add session-backed persistence. A sane default ("Past 3 months" instead of "everything ever") and a visual highlight of the active preset followed the next day.

### "We Can't See the Error"

The meta-bug. The reason everything else took so long.

Some failures happened entirely in PHP's shutdown phase - fatal errors, uncaught exceptions, memory exhaustion. SilverStripe's error handler never ran. Apache logged a one-liner. The admin saw a blank page or a generic 500. Nobody knew *what* broke.

I added temporary, gated observability: log fatal shutdown errors and uncaught exceptions to a writable temp file (readable over FTP), and optionally stream detailed error output to the response - but only for authenticated admins, and gated behind a flag that defaults to off. Just enough visibility to diagnose, without turning production into a confessional booth for every visitor.

Once the agent could *see* the errors, every other fix fell into place within hours.

### The Statistics Page That Rendered the Entire Universe

This one wasn't a 500 - it was a 200 that took *minutes*.

The statistics admin page rendered all tabs server-side in a single initial request. Orders, coupons, registrations - everything, all at once, like a waiter who brings every item on the menu to your table and asks you to pick. Under the hood, a filter stats code path was iterating tens of thousands of records, firing a `COUNT(*)` per record against a table with millions of rows and no useful indexes. A single text-matching filter query took about 13 seconds. Multiply by 20 filters.

The fixes: rewrite aggregate queries to avoid N+1 loops, cache repeated lookups per request, apply a default date range on entry so the page doesn't try to summarize all of recorded history, and optimize relationship queries to stop building enormous `IN (...)` lists. Performance went from "go make coffee" to "tolerable." Still not fast. But the building was no longer on fire.

### The Server Punches Back

One more thing. After deploying a fix, I got an immediate `Parse error: unexpected '?'` in production.

The fix used PHP's `??` null coalescing operator. The server's PHP version was too old to support it.

I rewrote it as `isset($x) ? $x : $default`, re-uploaded over FTP, and added "the server is running ancient PHP" to my mental model.

Oh, and sometimes I'd upload the correct fix and the site would still show the old behavior. OPcache had decided the previous code was fine, actually, and combined JS caches weren't helping either. The mitigation was a combination of `?flush=all`, clearing the combined-files cache directory, and occasionally toggling settings in the hosting panel to nuke the opcode cache. You haven't lived until you've debugged a fix that's correct but invisible because the runtime is nostalgic.

## Aftermath

Once the fires were out, I turned the one-off tooling into something reusable: user export CLI with registration filters, integration with an email marketing platform as a serverless function, and - critically - documentation. Split and structured so that the next person who gets handed FTP creds and a vague description of "it's not working" has a slightly less terrible day than I did.

A couple weeks later, another production issue surfaced: path handling bugs where `$_SERVER["DOCUMENT_ROOT"]` resolved to `/framework` under SilverStripe routing instead of the actual webroot. Replaced brittle document root references with `Director::baseFolder()` and hardened the CLI image generation scripts to normalize paths properly. Same workflow - patch, commit, FTP upload, verify. The toolbox held up.

Oh, and they gave me SSH access. After I'd already fixed everything. Classic.

## The Vibe Check

```
Deployment Sophistication Meter: [██░░░░░░░░] 2/10

  ✅ Changes are in version control
  ✅ Diffs are verified post-deploy
  ✅ Database access is read-only by default
  ✅ Exports work without the admin panel
  ✅ Unit tests exist for the FTP and DB tooling
  ✅ AI agent can autonomously trace bugs through the codebase
  ❌ "Deployment" means FTP put
  ❌ "Rollback" means FTP put again, but the old file
  ❌ "Monitoring" means running a script that tails a log over FTPS
  ❌ The server's PHP version doesn't support ??
  ❌ SSH arrived after the war was over
```

## FAQ (Mostly Honest)

**Why didn't you just set up SSH?**
They gave me SSH. After I'd already fixed everything. You work with the door they give you, even if they install a better door the day after you're done.

**You uploaded a web shell to production?**
A temporary one. Removed afterwards. When your only access is FTP and you need to understand the server environment *now*, you do what the situation demands.

**Isn't this just a glorified set of `curl` scripts?**
Yes. But glorified `curl` scripts *with guardrails, unit tests, structured logging, and documentation*. That's the difference between a hack and a tool.

**Why Python for the exporter?**
Because it needed to exist in an hour, not be beautiful.

**You wrote unit tests during a production firefight?**
For the FTP helpers and the DB read-only guardrails. In the same week I was uploading PHP files one at a time over FTPS. Professionalism doesn't have an off switch.

**How much did the AI agent actually do?**
More than me. I built the toolbox - the FTP scripts, the DB CLI, the deploy workflow. The agent did the actual PHP archaeology: tracing SilverStripe framework code, identifying the broken filters, spotting the N+1 patterns, writing the patches. I'm not a PHP developer anymore; the agent is. I just gave it legs and pointed it at the fire. Though I did have to stop it from downloading 300 GB of customer photos onto my SSD, so the supervision wasn't optional.

**Why didn't you just stop at the bot?**
Because the brain goblin doesn't negotiate. The bot was the job. Everything after was compulsion dressed up as initiative.

**Do you actually enjoy this kind of work?**
I know what I said. Don't judge me.

## The End

The site works now. The exports run. The filters filter. The admins can do their jobs without a 500 greeting them at every turn. I documented it, handed it back, and walked away. A clean break. Just like I promised.

The bottleneck was never intelligence - it was access. The AI agent knew more PHP than I've forgotten. It just couldn't *see* the server. Every hour I spent building tooling - the log tailer, the DB CLI, the FTP deploy script - paid for itself ten times over. The fixes found themselves once the agent had eyes.

And yes, I deployed production fixes over FTP. The server's PHP was so old my syntax was too modern for it. SSH arrived after the war was over.

I regret nothing.