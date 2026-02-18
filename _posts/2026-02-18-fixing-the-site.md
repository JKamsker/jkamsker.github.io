---
layout: post
title: "The Site Is on Fire. Here's Your FTP Password. Good Luck."
summary: A client's legacy SilverStripe site was 500ing on every admin action that mattered. My only access was FTP. So I built a portable toolbox to extract data, gather evidence, and deploy surgical fixes — file by file, over FTP, in 2026.
author: jkamsker
date: '2026-02-18 12:00:00 +0000'
category: devlog
thumbnail: /assets/img/posts/fixing-the-site.webp
keywords: silverstripe, php, legacy, ftp, debugging, cli-tooling, devops, production-firefighting
tags: [php, cli, devops]
permalink: /blog/fixing-the-site/
---

> **TL;DR:** A client's legacy SilverStripe site was 500ing on every admin workflow that mattered. The only access was FTP. No deploy pipeline, no error visibility, no version control. I loved every second of it. Built a CLI toolbox to extract data, tail logs, query the database, and deploy surgical fixes — all through FTP — then fixed the site in a day. Get in, patch her up, get out. A beautiful disaster.

## A Confession

I'll be honest: I have a thing for dirty code.

Not *my* dirty code — I write pristine, well-architected systems that definitely don't have `// TODO: fix this later` comments from 2019. No, I mean *other people's* dirty code. Legacy systems. The kind of codebase where the README says "just works" and the reality says "just barely." Hand me FTP credentials to a decade-old PHP site that's held together by session variables and sheer institutional denial, and something in my brain lights up like a Christmas tree.

Most developers see a legacy dumpster fire and feel dread. I feel the same thing a cave diver feels staring into a dark hole in the ground: this is going to be awful, I might not come back the same person, and I absolutely cannot wait to go in.

So when a client's legacy SilverStripe site landed on my desk — "not working," they said, which undersells it the way "the Titanic had a minor hull issue" undersells maritime history — I didn't groan. I cracked my knuckles.

Key admin workflows — filtering orders, exporting CSVs, pulling statistics — all produced HTTP 500s. The people who needed this data couldn't get it. The site was a locked filing cabinet that electrocuted you when you touched the handle.

And the constraints? *Chef's kiss.*

Access was FTP/FTPS and the live admin UI. That's it. No deployment pipeline. No "push a branch." Changes had to be uploaded file-by-file, like it was 2003 and we were all pretending this was fine.

Worse: some requests died before SilverStripe could even log them. Apache would just emit "End of script output before headers" — the server equivalent of a shrug — and move on. The application had no idea it had crashed. The server didn't care enough to explain why. I was debugging a crime scene where the victim, the witness, and the detective were all unconscious.

The plan was simple: get in, fix her up, get out. A one-night stand with a legacy codebase. No long-term commitment. No "let's refactor this properly." Just enough surgery to stop the bleeding, wrap it in a bow, and walk away whistling.

## The Strategy: Get the Data Out, Then Fix the Crime Scene

As much as I enjoy wallowing in legacy code, I'm not a barbarian. When you're standing in front of a burning building, you don't start by repainting the kitchen. You get people out first, *then* figure out what caught fire.

The work split into two tracks that fed each other:

**Track 1: Black-box extraction.** Get the data out of the site without touching production code. Replay the same admin requests the browser makes, but from a script. Safe. Reversible. Nobody gets electrocuted.

**Track 2: Make production debuggable.** Build tools to fetch evidence — logs, code, database state — over FTP. Then make small, surgical PHP changes and upload only those files. Confirm the fix by re-downloading and diffing.

This all kicked off on February 3rd. Most of it was done by midnight. I have the commit history to prove it, and the commit messages to prove I was losing it.

## Phase 1: Don't Touch Anything (Just Get the Data Out)

First order of business: the client needed order exports *today*, and the export button was one of the things producing 500s. So before I could fix anything, I needed a workaround that bypassed the broken UI entirely.

I wrote a Python exporter that logs into the admin panel and triggers the same SilverStripe GridField export actions a human would click — except it does it over HTTP, with structured logging, and without crashing. Added redaction to the HTTP logs so cookies and CSRF tokens wouldn't end up in version control, because I've read enough post-mortems to know that's how you get a *second* incident.

By mid-afternoon, non-technical team members could trigger exports through a chat slash command and get the CSV back in their messaging client. No admin panel required. No 500s. Just data.

I also wrapped the exporter in a serverless function for a more ops-friendly hosting option, and added CI that automatically exports the past month's data on every push and uploads it as an artifact.

This is the "the building is on fire but at least we carried the filing cabinet outside" phase.

## Phase 2: Build the Toolbox (So You Can See the Fire)

The exporter solved the immediate bleeding, but I still couldn't *see* what was wrong. The server was eating errors before they reached the application log. Apache's error log was on the server. The database was on the server. Everything I needed was behind FTP.

This is the part where a normal person would feel frustrated. I felt like a lockpicker being handed a really interesting lock.

So I built a portable CLI toolkit, piece by piece:

**FTP log tailing.** A script that connects over FTPS, downloads the latest log entries, and formats them locally. Because `tail -f` is great when you have SSH. When you have FTP, you improvise.

**Read-only database CLI.** A command-line tool that talks to the remote database, with guardrails — only `SELECT`, `SHOW`, `DESCRIBE`, and `EXPLAIN` are allowed, and it rejects multi-statement queries. I needed to inspect data, not accidentally `DROP TABLE` a client's order history because of a fat-fingered semicolon.

**FTP put for file-by-file deploys.** Upload exactly one changed file and nothing else. This became the deployment "pipeline." I documented the workflow: patch locally, commit, upload the changed file, re-download, diff to confirm. It's the saddest CI/CD you've ever seen, and it worked perfectly.

This was the turning point. The repo stopped being "just an exporter" and became a portable operations toolbox for a site I could only reach by FTP.

## Phase 3: Bring the Site Into Version Control (So You Can Think About It)

You can't reason about code that exists only on a remote server you access via FTP. So I mirrored the entire webroot locally and committed it. For the first time, this site was in version control.

I also started writing structured bug reports — symptoms, evidence, hypotheses — because by this point I had enough threads going that my brain alone was not a reliable storage medium.

From here, I could treat fixes like normal engineering: reproduce via logs, patch locally, commit, upload the changed file, verify by re-downloading and diffing.

It felt like putting on glasses after years of squinting. Same site. Suddenly legible.

## What Was Actually Broken

Here's where it gets fun. "Fun."

### Bug 1: The Type Filter That Referenced a Ghost Column

The admin orders page had a "Type" dropdown filter. When you selected an option, the UI sent a query parameter like `q[Type]=CouponItemID`. The server-side code obediently tried to filter on a column called `CouponItemID`.

That column didn't exist.

The dropdown values were raw internal identifiers that some past developer had wired directly into the UI — and at some point the schema had changed underneath them. The filter was sending SQL WHERE clauses into the void, and the database was responding the only way it knew how: by dying.

The fix: change the dropdown values to semantic keys and map them to the columns that actually exist in the filter logic. Fifteen minutes of work, once you know where to look. Finding where to look took considerably longer.

### Bug 2: The Export That Tried to Load the Entire Database Into RAM

The CSV export button triggered a SilverStripe GridField export action. Standard stuff — except GridField export removes pagination. All of it. It tries to export the *entire* filtered dataset in one go.

Combine that with "summary fields" that traversed relationships for every single row — classic N+1 query patterns — and you had a request that would either time out, exhaust PHP's memory, or crash the process before headers were even sent. This is why Apache was shrugging instead of logging: PHP was dying in the hallway before it could reach the error handler.

The fix came in three layers:

**Mitigation:** If an export request came in without explicit date filters, default to a bounded date range. Stop trying to export the entire history of the company in one HTTP request.

**Correctness:** Make the export action URL carry the current filter state, so the export respects whatever the admin actually filtered to. This required changes in both the framework's JavaScript (`GridField.js`) and the server-side code — the export button was ignoring filters entirely.

**Performance:** Override the export columns to avoid expensive per-row relationship computations during large exports. You don't need to traverse three levels of ORM relations to produce a CSV.

### Bug 3: Date Filters That Filtered on the Wrong Date

The admin date presets — "Last 7 days," "Last 3 months," "Today" — were filtering on the wrong timestamp column. The paginator count didn't reflect the filtered list. Filter state wasn't persisted across page loads.

Multiple fixes over a few hours: correct the timestamp column, fix the preset logic, add session-backed persistence, and reorder components so the paginator actually agrees with the filter. A follow-up the next day set a sane default ("Past 3 months" instead of "everything ever") and highlighted the active preset in the UI.

Small bugs, individually. Collectively, they made the admin panel feel like it was gaslighting you.

### Bug 4: "We Can't See the Error"

The meta-bug. The reason everything else took so long.

Some failures happened entirely in PHP's shutdown phase — fatal errors, uncaught exceptions, memory exhaustion. SilverStripe's error handler never ran. Apache logged a one-liner. The admin saw a blank page or a generic 500. Nobody knew *what* broke.

I added temporary, gated observability: log fatal shutdown errors and uncaught exceptions to a writable location, and optionally stream detailed error output to the response — but only for authenticated admins, and gated behind a flag. Just enough visibility to diagnose, without turning production into a confessional booth for every visitor.

This was the "we can't fix what we can't see" part of the story. Once I could see, every other fix fell into place within hours.

## Aftermath: Turn the Chaos Into Repeatable Operations

Once the fires were out, I turned the one-off tooling into something reusable: user export CLI with registration filters, integration with an email marketing platform as a serverless function, and — critically — documentation. Split and structured so that the next person who gets handed FTP creds and a vague description of "it's not working" has a slightly less terrible day than I did.

A couple weeks later, another production issue surfaced: path handling bugs where `$_SERVER["DOCUMENT_ROOT"]` resolved to `/framework` under SilverStripe routing instead of the actual webroot. Replaced brittle document root references with `Director::baseFolder()` and hardened the CLI image generation scripts to normalize paths properly. Same workflow — patch, commit, FTP upload, verify. The toolbox held up.

## The Vibe Check

```
Deployment Sophistication Meter: [██░░░░░░░░] 2/10

  ✅ Changes are in version control
  ✅ Diffs are verified post-deploy
  ✅ Database access is read-only by default
  ✅ Exports work without the admin panel
  ❌ "Deployment" means FTP put
  ❌ "Rollback" means FTP put again, but the old file
  ❌ "Monitoring" means running a script that tails a log over FTPS
  ❌ It's 2026
```

## FAQ (Mostly Honest)

**Why didn't you just set up SSH?**
Access constraints weren't mine to change. You work with the door they give you, even if that door is FTP.

**Isn't this just a glorified set of `curl` scripts?**
Yes. But glorified `curl` scripts *with guardrails, structured logging, and documentation*. That's the difference between a hack and a tool.

**Why Python for the exporter?**
Because it needed to exist in an hour, not be beautiful. Python is the language you write when the building is on fire and aesthetics are a luxury.

**Could an AI agent have done this?**
Parts of it, absolutely — once the toolbox existed. That's kind of the point. The toolbox gave agents (and humans) the ability to see what's happening, query the database, read logs, and deploy fixes. Before the toolbox, everyone — human and AI alike — was groping around in the dark.

**Will you ever stop being dramatic about FTP?**
No. It's 2026 and I deployed production fixes by uploading PHP files one at a time. If anything, I'm *under*-dramatic.

**Do you actually enjoy this kind of work?**
I know what I said. Don't judge me.

## What I Actually Learned

The technical fixes were straightforward once I could see them. The *hard* part was building the scaffolding to see them in the first place. Every hour I spent on tooling — the exporter, the log tailer, the DB CLI, the FTP deploy workflow — paid for itself ten times over in the hours that followed.

When someone hands you a broken production system and a set of constraints that feel impossible, the instinct is to start fixing things immediately. The better move is to spend the first few hours making the system *legible*. Mirror the code. Write down what you see. Build tools that let you look without touching.

Then the fixes find themselves.

The site's working now. The exports run. The filters filter. The admins can do their jobs without a 500 greeting them at every turn. I wrapped it up, documented it, handed it back, and walked away.

A clean break. Just like I promised.

But I'd be lying if I said I didn't enjoy it. There's something deeply satisfying about diving headfirst into a dumpster fire, emerging twelve hours later covered in soot and session cookies, and leaving behind something that actually works. It's not the kind of work you put on a conference talk. It's the kind of work you tell war stories about.

And yes, I deployed production fixes over FTP in 2026. I regret nothing.