# POS manager (the monitor)

An always-on watcher that is **separate from the app's servers**. It checks that the system works, that every
number adds up, that cash and shifts look right, and that nothing is running out — then tells you on Telegram.

## How it is built (all free)

| Part | Where it runs | What it does |
|---|---|---|
| **Checks** (`monitor/run.mjs`) | GitHub Actions, every hour (`.github/workflows/monitor.yml`) | Loads each restaurant's records (read-only), runs the number rules (`src/numbers-check.js` — the same ones as the release gate), the business checks (`checks/business.mjs`), space/backups (`checks/capacity.mjs`), answers Telegram messages, sends alerts and the Thursday report |
| **Uptime watch** (`monitor/worker`) | Cloudflare Worker, every minute | Is the POS reachable and answering? Alerts after 2 bad minutes, and again when it recovers |
| **Memory** | `monitor-state` branch of this repository | Which problems are open, who receives messages, what you've explained, trends |
| **Dead-man switch** | healthchecks.io (free) | If the monitor itself stops running, you get told |
| **Reports / alerts** | Telegram bot | 🔴 immediately · 🟡 in the weekly report and `/status` · 🟢 weekly "all good" |

Nothing here can change a restaurant's data. The only writes are the monitor's own notes and Telegram messages.

## What it checks

* **Calculations** — the day's revenue is the same on Dashboard, Receipts, Close the day and Staff; payment methods add up; shifts + "outside any shift" = the day; the month = its days; the leaderboard = the Dashboard; every order's lines add up; no duplicates; no overlapping shifts.
* **Cash** — drawer short/over per shift (amber from 20 EGP, red from 100), cash taken out between shifts (reported as *pickups*), shifts without a count, forgotten clock-outs, shifts open too long, orders rung up with nobody clocked in.
* **Orders** — customer orders waiting too long for staff, no sales for hours when there normally are some, a sharp drop against the same weekday.
* **Data** — expenses without a time, days not signed off (when the restaurant normally does).
* **Subscriptions** — a restaurant's paid-until date (the POS blocks itself the day after).
* **Capacity** — database space (free plan 500 MB; amber at 60 %, red at 80 %), safety-copy freshness, growth forecast. Vercel/Supabase transfer limits can't be read automatically: send the numbers with `/usage` once a month.
* **Support access** — every use of the hidden support sign-in on a restaurant's terminal is reported immediately (🔴, from the hourly round), as are repeated wrong codes and lock-outs; the test restaurant is silent. The weekly report counts them.
* **Availability** — the POS page and data service, every minute, including Vercel's "payment required" pause.

Thresholds live in `monitor/config.json`.

**Day-end cash collection.** If a restaurant takes the cash out of the drawer at the end of the day, the last shift of the day looks "short" by exactly that amount. Put the restaurant's id in `dayEndCollection` in `config.json` and that last difference is reported as an amount to check against what was really taken (🔵), instead of as a shortage. Earlier shifts of the day stay strict.

## Telegram commands

`/status` open items · `/report` send the weekly report now · `/explain <id> <why>` tell me the reason for something
(I remember it; confirming that cash pickups are normal stops them being flagged) · `/usage vercel_calls=… vercel_gb=… supabase_egress_gb=…` ·
`/invite` makes a join code · `/join <code>` · `/approve <chat>` · `/remove <chat>`.
Messages sent to the bot are answered during the hourly round (within about an hour).

## One-time setup (needs your accounts)

1. **Telegram bot** — in Telegram open `@BotFather`, send `/newbot`, copy the token. Then message your new bot `/start` and tell me; I read your chat id.
2. **GitHub secrets** — run `powershell -ExecutionPolicy Bypass -File monitorcopy-secrets.ps1`. It opens the right GitHub page and, one by one, tells you the name to type and puts the value on your clipboard (the two database values come from `.env.local`; the two Telegram ones you copy from Telegram). The four are `SUPABASE_URL`, `MONITOR_SUPABASE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_IDS` (your chat id; add more owners with commas). `HEALTHCHECK_URL` can be added later (step 3).
3. **healthchecks.io** — free account; make two checks: *GitHub hourly* (period 1 h, grace 1 h) and *Uptime Worker* (period 1 min, grace 5 min); connect both to your Telegram. Put the first URL in the GitHub secret and the second in the Worker.
4. **Cloudflare Worker** — free account; `npx wrangler kv namespace create STATE`, paste the id into `monitor/worker/wrangler.toml`, set the secrets (`wrangler secret put TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_IDS`, `HEALTHCHECK_URL`), then `npx wrangler deploy`.
5. **Backup heartbeat** — I add one line to the nightly backup so healthchecks.io hears from it every night (a third check, period 1 day).

### About the database key
For now the monitor uses a key that could in principle write, but the code only ever calls `select`. The stricter version
is a read-only database role (`monitor_ro`); once your Supabase JWT secret is available I generate a key for it and swap it in.

## Running it by hand

```
npm run monitor -- check --dry --no-confirm      # every check, prints instead of sending
npm run monitor -- weekly --dry --force          # preview the Thursday report
npm run monitor -- status                        # what is open
npm run monitor:test                             # self-test of the chat commands
```
