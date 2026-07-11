#!/usr/bin/env bash
# Permanent watchdog — keeps both services alive. Restarts either if it dies.
# Runs in background, checks every 5 seconds.
cd /home/z/my-project
echo "$(date +%T) watchdog started" >> watchdog.log
while true; do
  # restart market service if dead
  if ! (ss -ltn 2>/dev/null | grep -q ':3003'); then
    nohup bun --hot mini-services/market-data/index.ts >> market.log 2>&1 &
    disown
    echo "$(date +%T) restarted market-data" >> watchdog.log
  fi
  # restart dev server if dead
  if ! (ss -ltn 2>/dev/null | grep -q ':3000'); then
    nohup bun run dev >> dev.log 2>&1 &
    disown
    echo "$(date +%T) restarted next dev" >> watchdog.log
    sleep 8  # give it time to boot
  fi
  sleep 5
done
