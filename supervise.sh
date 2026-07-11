#!/usr/bin/env bash
# Supervisor: keeps the market-data service (3003) and Next dev server (3000) alive.
# Restarts either if it dies. Logs to supervised.log.
cd /home/z/my-project

start_market() {
  if ! (ss -ltn 2>/dev/null | grep -q ':3003'); then
    nohup bun --hot mini-services/market-data/index.ts >> /home/z/my-project/market.log 2>&1 &
    disown
    echo "$(date +%T) started market-data (pid $!)"
  fi
}

start_dev() {
  if ! (ss -ltn 2>/dev/null | grep -q ':3000'); then
    nohup bun run dev >> /home/z/my-project/dev.log 2>&1 &
    disown
    echo "$(date +%T) started next dev (pid $!)"
  fi
}

while true; do
  start_market
  start_dev
  sleep 8
done
