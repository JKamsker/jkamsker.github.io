---
layout: post
title: "A Thunderbird's Tale: Taming Google Calendar"
summary: How to sync shared Google Calendars with Thunderbird using a CalDAV workaround when iCal links fail.
author: jkamsker
date: '2025-09-08 12:00:00 +0000'
category: guides
thumbnail: /assets/img/posts/code.jpg
keywords: thunderbird, google-calendar, caldav, ical, shared-calendar, sync, workaround
tags: [productivity, workaround]
permalink: /blog/taming-google-calendar-thunderbird/
---

I'm a big fan of Mozilla Thunderbird, but I recently hit a snag trying to sync a shared Google Calendar. The official support guide, unfortunately, didn't solve the problem, so I had to do some digging. Here's what I found.

## When The Official Guide Fails

I started with the official Mozilla instructions. The process seemed simple: use my Google email to let Thunderbird's auto-discovery find my calendars. I followed the steps (`≡ > New Account > Calendar > On the Network > Next`), entered my username, but it found nothing. No Google sign-in prompt, no calendars. A dead end.

## Trying iCal Links

Next, I tried a more manual approach using the private iCal address from my Google Calendar's settings ("Settings and sharing" > "Secret address in iCal format"). This worked perfectly for my *own* calendars. For example, a private iCal link for a personal calendar looks something like this:
`https://calendar.google.com/calendar/ical/your.email%40gmail.com/private-a1b2c3d4e5f6/basic.ics`

However, when I tried the same iCal link from a shared calendar, Thunderbird wouldn't accept it. It was progress, but not a complete solution.

## The CalDAV Workaround

After some digging, I noticed that for the calendars that *did* sync, Thunderbird wasn't actually using the iCal link. It was connecting via a CalDAV URL that looked something like this:

`https://apidata.googleusercontent.com/caldav/v2/[calendar-id]%40group.calendar.google.com/events/`

This was the key. Google Calendar doesn't give you this link directly for shared calendars, so I had to build it myself.

Here's the fix:

1.  In Google Calendar, go to the settings for the *shared* calendar.

2.  Copy the **public address in iCal format**. It will look different from your private one, often containing a long calendar ID and a private key, like this:
    `https://calendar.google.com/calendar/ical/a1b2c3d4e5%40group.calendar.google.com/private-x1y2z3/basic.ics`

3.  From that URL, extract the calendar's ID (the long part ending in `@group.calendar.google.com`). In the example above, it would be `a1b2c3d4e5@group.calendar.google.com`.

4.  Slot that ID into the CalDAV URL structure shown above.

5.  Paste that newly constructed URL into Thunderbird's calendar location field.

Once I did that, the Google OAuth permission screen popped up, I signed in, and the shared calendar was finally added to my Thunderbird.

It took some troubleshooting, but it's a solid workaround for a frustrating problem. Hopefully, this helps anyone else running into the same issue!
