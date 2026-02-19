---
layout: post
title: "A Thunderbird's Tale: Taming Google Calendar"
summary: How to sync shared Google Calendars with Thunderbird using a CalDAV workaround when iCal links fail.
author: jkamsker
date: '2025-09-08 12:00:00 +0000'
category: guides
thumbnail: /assets/img/posts/thunderbird-calendar.webp
keywords: thunderbird, google-calendar, caldav, ical, shared-calendar, sync, workaround
tags: [productivity, workaround]
permalink: /blog/taming-google-calendar-thunderbird/
---

> **TL;DR:** Thunderbird won't sync shared Google Calendars through the normal flow. The official guide is useless. iCal links work for *your* calendars but not shared ones. The fix: manually build a CalDAV URL from the calendar's ID and paste it in. Google's OAuth prompt appears, you sign in, and suddenly the calendar exists. The whole thing took 90 minutes of debugging and 30 seconds of actual solution.

## I Just Want My Calendar

I like Thunderbird. This is a controversial opinion in some circles, but I stand by it. It handles email, it handles calendars, and it doesn't try to upsell me on a premium tier every time I open it.

What it does *not* handle gracefully is syncing shared Google Calendars. And by "not gracefully" I mean "not at all, through any documented method, without manual intervention that Google and Mozilla apparently agreed to never tell anyone about."

## Attempt 1: The Official Guide

I started where any reasonable person would - Mozilla's official support docs. The process seemed straightforward: go to `≡ > New Account > Calendar > On the Network > Next`, enter your Google email, and let Thunderbird's auto-discovery find your calendars.

I entered my email. Thunderbird thought about it for a moment. Then it found... nothing. No Google sign-in prompt. No calendar list. Just a blank screen and the quiet sound of my afternoon evaporating.

Dead end. Next.

## Attempt 2: iCal Links (Partial Credit)

Google Calendar lets you grab a "Secret address in iCal format" for each calendar. It looks something like:

`https://calendar.google.com/calendar/ical/your.email%40gmail.com/private-a1b2c3d4e5f6/basic.ics`

I pasted this into Thunderbird and - it worked! For my *own* calendars. Perfect sync, no issues.

For the *shared* calendar I actually needed? Thunderbird rejected the iCal link like a bouncer checking IDs. Same format, same source, different result. Helpful.

So: personal calendars via iCal? Fine. Shared calendars via iCal? Absolutely not. This is the kind of inconsistency that makes you question whether software is a mature engineering discipline or an elaborate prank.

## Attempt 3: The CalDAV Discovery

While poking around Thunderbird's calendar settings for the calendars that *did* sync successfully, I noticed something interesting. Thunderbird wasn't actually using the iCal URL I'd given it. Behind the scenes, it had quietly swapped in a CalDAV URL:

`https://apidata.googleusercontent.com/caldav/v2/[calendar-id]%40group.calendar.google.com/events/`

That's... not documented anywhere obvious. Google doesn't hand you this URL for shared calendars. Thunderbird doesn't tell you it's using it. It's like finding out your car has a turbo button that nobody mentioned because it's behind the glove compartment.

## The Fix (It's Embarrassingly Simple)

Once I knew the URL pattern, the rest was assembly:

1. Open Google Calendar settings for the shared calendar.
2. Copy the **public address in iCal format** - it contains a long calendar ID like `a1b2c3d4e5@group.calendar.google.com`.
3. Extract that calendar ID.
4. Slot it into the CalDAV URL template: `https://apidata.googleusercontent.com/caldav/v2/[CALENDAR-ID]/events/`
5. Paste the constructed URL into Thunderbird's calendar location field.

The Google OAuth screen appeared. I signed in. The shared calendar materialized in Thunderbird like it had been there all along, casually pretending the last 90 minutes hadn't happened.

```
Frustration-to-Fix Ratio: [██████████] 10/1

  90 minutes of debugging
  30 seconds of actual solution
  0 lines of documentation that would have prevented this
```

## Why This Is Annoying

The information to make this work exists in the system. Thunderbird *knows* the CalDAV pattern - it uses it internally. Google *exposes* the calendar ID - it's right there in the iCal URL. Neither party connects the dots for the user. It's like two people each holding half a map and refusing to stand next to each other.

If you're hitting this same wall - shared Google Calendar, Thunderbird, auto-discovery failing, iCal links rejected - this is the fix. Build the CalDAV URL yourself, paste it in, and move on with your life.

You're welcome. I'm going to go close 14 browser tabs.
