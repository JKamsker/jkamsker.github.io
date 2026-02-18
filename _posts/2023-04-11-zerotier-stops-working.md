---
layout: post
title: "The Problem: ZeroTier Stops Working"
summary: A quick workaround for ZeroTier going offline on a Raspberry Pi — a cron job that auto-restarts the service.
author: jkamsker
date: '2023-04-11 12:00:00 +0000'
category: guides
thumbnail: /assets/img/posts/code.jpg
keywords: zerotier, vpn, raspberry-pi, networking, cron, workaround, linux
tags: [linux, networking, devops]
permalink: /blog/zerotier-stops-working/
---

## The Problem: ZeroTier Stops Working
ZeroTier has been a reliable solution for establishing VPN connections between devices, even when they are located behind NAT. However, after installing ZeroTier on my brother's Raspberry Pi home server, I encountered a baffling issue: it would work fine for the first hour or so, and then lose connection from outside. The only way to re-establish the connection was to reboot the Raspberry Pi.

This problem was further compounded by the fact that if I had an ongoing file copy operation, I could still connect to the Raspberry Pi from the specific machine involved in the transfer. But if I switched to another device, like my laptop, I couldn't connect at all. The `sudo zerotier-cli info` command showed the status as "OFFLINE."
## The Investigation: Searching for the Root Cause
After scouring the internet for answers and receiving advice from fellow Redditors, I opted for a workaround instead of pinpointing the root cause. This involved creating a script that checks ZeroTier's status periodically and restarts the service if it's offline.

Here's the script I used (`check_zerotier.sh`):

```bash
#!/bin/bash

# Check if the response from "zerotier-cli status" contains "OFFLINE"
status=$(/var/lib/zerotier-one/zerotier-cli status)

if [[ $status == *"OFFLINE"* ]]; then
    echo "OFFLINE! Restarting zerotier-one"
    # If it does contain "OFFLINE", restart zerotier with the command "service zerotier-one restart"
    /usr/sbin/service zerotier-one restart
fi

if [[ $status == *"ONLINE"* ]]; then
    echo "ONLINE! Doing nothing"
fi

```

To automate the process, I added an entry in the `crontab` file to run the script every 10 minutes:

```bash
*/10 * * * * /usr/scripts/check_zerotier.sh 2>&1 | /usr/scripts/formatLog.sh 2>&1 >> /var/log/zt_check.log 2>&1

```

I also created a `formatLog.sh` script to format the log output:

```bash
#!/bin/bash

while read line; do
  current_time=$(date +"[%Y-%m-%d %H:%M:%S]")
  echo "$current_time $line"
done
```

## The Workaround: A Reliable Solution
By implementing this workaround, I managed to bypass the issue and ensure that ZeroTier remains functional on my brother's Raspberry Pi home server. While I didn't identify the root cause of the problem, this solution has been effective in keeping the connection stable and preventing any disruptions.
## Conclusion
Sometimes, finding the root cause of an issue can be like searching for a needle in a haystack. In cases like these, it's essential to focus on finding a reliable workaround that can keep things running smoothly. In my case, a simple script and a cron job were enough to prevent ZeroTier from going offline and maintain a stable connection.

I hope you found this blog entry interesting and informative! Stay tuned for more exciting adventures in the world of technology and problem-solving.
