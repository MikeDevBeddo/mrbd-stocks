# Stocks — Meta Ray-Ban Display web app

An Apple Stocks–styled watchlist for Meta Ray-Ban Display glasses: a list of sparklines whose
time range you switch on the main screen, a detail screen per stock, and D-pad search to add or
remove symbols — with no text field, because the runtime has none.

600 × 600 · vanilla HTML/CSS/JS · no build step · no dependencies.

---

## ▸ Open it on your glasses

**Scan this from the phone paired with your glasses:**

![QR code opening the Stocks web app on Meta Ray-Ban Display](qr-deeplink.png)

Live app — **https://mikedevbeddo.github.io/mrbd-stocks/**

The QR encodes the Web App deep link:

```
fb-viewapp://web_app_deep_link?appName=Stocks&appUrl=https%3A%2F%2Fmikedevbeddo.github.io%2Fmrbd-stocks%2F
```

Requires glasses v125+ and Meta AI app v272+. Regenerate the QR after redeploying elsewhere:

```bash
npm run qr -- https://your-url/ "Stocks"
```

(The `qrcode` CLI emits a QR whose light modules are fully transparent — invisible on any
dark background. `scripts/make-qr.js` flattens it onto opaque white before writing the PNG.)

No glasses to hand? Open `/simulator.html` — a 600 × 600 lens with additive blending and an
on-screen D-pad. [Jump to Run it](#run-it).

---

## How you build for these glasses today

Meta shipped display access to third parties in **May 2026**, adding display capabilities to the
Wearables Device Access Toolkit. There are two supported paths:

| Path | What it is | When to use |
|---|---|---|
| **Device Access Toolkit** | Native mobile SDK (Swift / Kotlin). Your existing iOS or Android app extends itself onto the glasses, with camera, audio and display access. | You already have a phone app and want a glasses surface for it. |
| **Web Apps** | A standalone HTML/CSS/JS page loaded from an HTTPS URL. No app store, no proprietary framework. | Standalone micro-apps, information overlays, live data readouts. **This project.** |

Hard constraints the Web Apps runtime imposes (all honoured here):

- **600 × 600 fixed viewport**, no page scrolling; `<meta name="mrbd-web-app-capable" content="yes">` required.
- **Additive waveguide**: pure `#000` emits no light and reads as fully transparent; bright,
  high-contrast colors on dark backgrounds are what stays legible over the real world.
- **D-pad only.** The Neural Band's sEMG gestures and the temple captouch strip arrive as
  `ArrowUp/Down/Left/Right` and `Enter`. No cursor, no touch.
- **Unsupported:** camera, microphone, **text input**, offline support, notifications,
  **back navigation**, continuous cursor.
- Available web APIs: `DeviceMotionEvent`, `DeviceOrientationEvent`, `navigator.geolocation`
  (GPS from the paired phone), `localStorage` / `sessionStorage` (5 MB).
- Budgets: < 3 s load, < 500 KB JS, 60 fps, < 128 MB, < 10 network requests.
- Icons must be PNG ≥ 52 × 52 — **SVG favicons are not supported**.
- Requirements: glasses v125+, Meta AI app v272+, and a **public HTTPS** URL.

Sources: [Build for display glasses](https://developers.meta.com/blog/build-for-display-glasses/) ·
[Web Apps build guide](https://wearables.developer.meta.com/docs/develop/webapps/build/) ·
[Wearables docs](https://wearables.developer.meta.com/docs) ·
[Official starter kit](https://github.com/facebookincubator/meta-wearables-webapp)

### Two constraints that shaped this app

**No text input.** Search cannot be a field. It is an on-screen A–Z rail: `◀▶` arms a letter,
`Enter` appends it, and the catalogue filters by prefix as you build it.

**No back navigation.** The build guide's own sample maps `Escape` to `history.back()`, but the
same document lists Back Navigation as unsupported — so `Escape` may never fire on device. Every
screen therefore has an exit that is a cursor target reachable with arrows and `Enter` alone:

| Screen | Way out |
|---|---|
| Detail | `Enter` (nothing else on the screen is activatable) |
| Edit list | the **← Done** row at the foot of the list |
| Add stock | the **←** key that leads the A–Z rail |

`Escape` is still handled where it makes sense, but nothing depends on it.

---

## Controls

### Watchlist (main screen)

| Gesture | Action |
|---|---|
| `▲` `▼` | Move the cursor through the list |
| `◀` `▶` | Cycle the range: 1D · 1W · 1M · 6M · 1Y · 5Y — **every sparkline and badge follows** |
| `Enter` | Open the focused stock's detail, or **Market** / **Edit List** at the foot |

### Markets

Five exchanges, each with its own watchlist, all served by the same Yahoo adapter through the
ticker suffix (`.L`, `.HK`, `.T`, `.AX`):

| | Fallback schedule (local) | Zone |
|---|---|---|
| US | 09:30 – 16:00 | America/New_York |
| London | 08:00 – 16:30 | Europe/London |
| Hong Kong | 09:30 – 16:10 | Asia/Hong_Kong |
| Tokyo | 09:00 – 15:30 | Asia/Tokyo |
| Sydney | 10:00 – 16:00 | Australia/Sydney |

The header's top right names the active exchange and its local clock, green while it is trading.
The **Market** row at the foot of the watchlist opens the picker, which shows every exchange's
local time and whether it is open; when another market is trading the row says so inline.

At startup, if the remembered exchange is shut and another is open, the app switches to the open
one — only then, never mid-session, so a list is not yanked out from under you. Adding or
removing a stock affects the active market's list alone.

### Why there is no holiday calendar

Because the exchange ships one. Yahoo returns `meta.currentTradingPeriod.regular` — the actual
open and close instants of the current session — with every quote, and the app uses it in
preference to the table above.

That is worth more than any calendar this project could bundle. It is right about public
holidays (on a closed day the reported window is simply a different date, so the session never
reads as open), about half-day early closes, about daylight saving, and about details a
hand-written schedule gets wrong. Two it caught immediately: **Hong Kong closes at 16:10** and
**Sydney at 16:12**, not on the hour — both carry a closing auction. A shipped calendar would
also have started rotting the day it was written.

The fixed schedule above survives only as the fallback for the first paint, before any quote has
landed, and for demo mode. The header says which is in force implicitly: once live, a closed
market shows when it next opens — `LONDON · CLOSED · OPENS 08:00` — a time that comes from the
exchange, not from arithmetic.

Tokyo's lunch break (11:30–12:30) is not reflected: Yahoo reports one continuous session, so the
app does too.

London quotes in **GBp — pence**, so `11,850.00` is £118.50. The detail screen's Exchange cell
shows the currency for exactly this reason.

### Detail

| Gesture | Action |
|---|---|
| `▲` `▼` | Previous / next stock without going back to the list |
| `◀` `▶` | Cycle the range |
| `Enter` | Back to the watchlist |

### Edit list

`▲` `▼` to select, `Enter` to activate: **＋ Add Stock**, **⊖ Remove** on any row, or **← Done**.
The last remaining stock cannot be removed.

### Add stock

`◀` `▶` moves along `←` A–Z `⌫`, `Enter` types the armed key, `▼` drops into the results,
`▲` from the top result returns to the rail, `Enter` on a result adds it and returns to the
watchlist with the new stock selected.

A new stock is **prepended**, so it lands at the top of the watchlist and one press below
**＋ Add Stock** in the edit list — appending buried it at the foot of a scrolling list where its
Remove row was awkward to reach.

Watchlist contents, range, and cursor position persist to `localStorage`.

---

## Run it

```bash
npm start                       # http://localhost:3001  (PORT=4173 npm start to change)
```

- `/` — the app exactly as the glasses render it (600 × 600).
- `/simulator.html` — **desktop QA harness**: pins the app in a real 600 × 600 lens, applies
  `mix-blend-mode: screen` to reproduce the additive display, draws a "world" behind the lens,
  and gives you an on-screen D-pad. Real arrow keys are forwarded in. Toggle the world off to
  judge contrast against pure black.

## Deploy your own copy

The app is fully static — `server.js` is only for local dev — so any host with valid TLS works
(GitHub Pages, Vercel, Netlify, Cloudflare Pages). **HTTP-only URLs are rejected by the glasses.**

This copy is published from `main` at the repo root:

```bash
gh repo create mrbd-stocks --public --source=. --push
gh api -X POST repos/:owner/mrbd-stocks/pages -f "source[branch]=main" -f "source[path]=/"
```

Then regenerate the QR for your URL with the command in the [box at the top](#-open-it-on-your-glasses).

## Regenerate the icon

`icon.png` (64 × 64) is generated, not hand-drawn — no image editor or dependency:

```bash
npm run icon
```

---

## Data — what is real and what is not

Two independent data sources, and they do **not** have the same status.

### Symbol catalogue — real, fetched, no key required

Twelve Data's `/stocks` reference endpoint is public and sends CORS headers, so the app pulls the
real NASDAQ + NYSE symbol list — **6,400+ symbols** — filtered to common stock, ETFs, REITs and
depositary receipts. Measured: 1.2 MB / 4.5 s for NASDAQ, 0.8 MB / 0.9 s for NYSE.

Because of that cost it is **lazy**: the bundled 80-symbol list renders instantly, the network
pull happens only when *Add Stock* opens, and the trimmed result (271 KB) is cached in
`localStorage` for 7 days and re-read at startup. Any failure falls back to the bundled list
with a toast. Set `CONFIG.catalogSource = 'bundled'` to disable the request entirely.

### Prices — synthetic, and labelled as such

**The `demo` provider is not market data.** The header carries a `DEMO` badge whenever it is
active, so a demo is never mistaken for live quotes.

It is a seeded geometric random walk: five years of daily OHLCV per symbol plus a
Brownian-bridge intraday path for the current day. Seeded from the ticker, so a symbol always
draws the identical chart, and every range is sliced from one shared series — 1D, 1M and 5Y stay
mutually consistent. Symbols outside the curated anchors derive their parameters from their own
seed, which is why any of the 6,400 fetched symbols charts immediately.

For those derived symbols, **Mkt Cap and P/E render as `—` rather than a number.** An invented
chart under a DEMO badge is the point of the demo; an invented market cap reads as a fact, and a
seeded guess lands nowhere near reality (NBIS came out at 274 B against an actual ~45 B).

Validated against NBIS (Nebius Group N.V.) with real Yahoo Finance data as ground truth:

| | app (demo) | actual |
|---|---|---|
| Price | 146.87 | 189.88 |
| 52-week range | 85.32 – 163.25 | 62.01 – 299.86 |
| 1M change | −7.82 % | −2.72 % |

Structurally sound — one price across all six ranges, `Low ≤ price ≤ High`,
`52W L ≤ price ≤ 52W H`, no gaps or `NaN` — and factually fiction. That is the demo provider
working as designed, not a bug.

### Turning on real prices

The obstacle is CORS, not money. A browser may only read a response from a server that opts in
with an `Access-Control-Allow-Origin` header, and the free keyless quote sources do not send one.
Measured from the browser, with real CORS rules applied:

| Endpoint | Free | CORS | Usable from the page |
|---|---|---|---|
| `twelvedata /stocks` | ✅ no key | ✅ | **yes** — this is the symbol catalogue |
| `query1/query2.finance.yahoo.com` | ✅ no key | ❌ | only through a proxy |
| `stooq.com` CSV | ✅ no key | ❌ | no |
| `twelvedata /time_series` | key | ✅ | with a key |
| `finnhub /stock/symbol` | key | ✅ | with a key |

Hence the split you can see in the app: NBIS shows the real name *Nebius Group N.V.* from the
catalogue, but a fabricated price. Two ways to close the gap.

**Option A — Yahoo through your own proxy (no API key).** `worker/yahoo-proxy.js` is a
Cloudflare Worker that fetches Yahoo and adds the missing header. Free tier, 100k requests/day,
no card:

```bash
npm i -g wrangler
wrangler login
cd worker && wrangler deploy
```

Then in `app.js`:

```js
provider:   'yahoo',
yahooProxy: 'https://mrbd-yahoo-proxy.<subdomain>.workers.dev/?url=',
```

The worker only forwards to `query1/query2.finance.yahoo.com` — without that allowlist the URL
would be an open relay anyone could abuse. Note Yahoo's endpoint is undocumented and carries no
usage guarantee; fine for personal use, not something to build a product on.

**Option B — Twelve Data key.** `provider: 'twelvedata'` plus `apiKey`. Documented and supported,
800 requests/day free. The adapter is written to the documented `time_series` shape but **has not
been run against a live key.**

To try a proxy on the glasses, where you cannot edit a file, set it at runtime instead:

```js
localStorage.setItem('mrbd.yahooProxy', 'https://…workers.dev/?url=')
```

**Verified end to end** with the Yahoo adapter live — every figure matched a direct
`curl` to Yahoo exactly:

| | AAPL | MSFT | NVDA | GOOGL | AMZN | TSLA | META | SPY |
|---|---|---|---|---|---|---|---|---|
| Price | 312.41 | 499.86 | 218.99 | 357.75 | 272.26 | 319.53 | 589.90 | 768.56 |
| 1M | +0.56% | +28.55% | +11.20% | −2.53% | +10.68% | −20.69% | −4.17% | +2.79% |

In live mode the detail screen's Open / High / Low / Volume / 52-week range come from the
provider too, rather than the demo bar. Yahoo's chart endpoint carries no market cap, so that
cell stays `—` for symbols without a curated anchor.

Whichever provider is on, demo data still paints the first frame and is replaced in place when
the response lands; on failure the app stays on demo data and shows a toast. Only the focused
symbol + range is fetched, cached 60 s, which keeps it inside the 10-request budget.

---

## Design system

Values come from the official build guide, not invented:

| Token | Value |
|---|---|
| Background / surface | `#1C1E21` / `#26292E` |
| Text / secondary / muted | `#FFFFFF` / `#E4E6EB` / `#B0B3B8` |
| Up / down | `#32D74B` / `#FF453A` (Apple dark-mode green/red) |
| Cursor ring | `#00D4FF` + `0 0 20px rgba(0,212,255,.4)` |
| Safe zone | 14 px padding (guide minimum: 8) |
| Row height | 88 px (guide minimum target) |
| Type scale | 28 / 22 / 16 / 13 / 12 px |

Want the see-through HUD look instead of a dim grey plate? Set `--bg: #000000` in `styles.css` —
on an additive display that renders as fully transparent.

### One deliberate architectural choice

The D-pad cursor lives in app state and is painted with a `.cursor` class — it is **not**
`document.activeElement`. A browser resets `activeElement` to `<body>` whenever its frame is
blurred (an OS window switch, or clicking any control outside the page). Keying off DOM focus
means the cursor silently disappears and `Enter` becomes a no-op. DOM focus is still applied for
accessibility, but it mirrors the state rather than defining it.

---

## Verified

Driven over CDP in Chromium at the real 600 × 600 layout.

**Reachability — 21 assertions, driven with `ArrowUp/Down/Left/Right` and `Enter` only.**
`Escape` was rejected by the harness, proving nothing depends on unsupported back navigation:

- Every watchlist row plus the Edit List entry reachable by `▼` alone.
- Range cycling drives the hero-less list: all sparklines and badges re-render together.
- `Enter` opens detail; detail steps symbols, changes range, and **exits with `Enter`**.
- Edit list exposes Add, every symbol's Remove, and Done; removal updates the watchlist and the
  count; **exits via Done**.
- All 28 rail keys reachable with `◀▶`; prefix typing and backspace work; `▼` enters results and
  keeps the armed letter marked; adding returns to the watchlist with the stock selected;
  **exits via the ← key**.
- A network-only symbol (AMAT, absent from the bundled list) searched, added, and charted.

**Layout and data:**

- Body measures exactly 600 × 600 with **zero page overflow** on every screen.
- All 6 ranges render finite, in-bounds geometry — including the 78-point intraday path — with
  no `NaN` across the sparklines.
- The list scrolls exactly one 88 px row per press and lands flush at the end; the scrollbar is
  deliberately visible, since it is the only cue that more list exists below the fold.
- 6,425 symbols fetched and cached at 271 KB; total `localStorage` use 271 KB of the 5 MB budget.
- ~54 KB of source uncompressed (budget: 500 KB), no dependencies, no build step.

## Files

```
index.html            four screens: watchlist, detail, edit list, add stock
styles.css            design system, cursor states, Apple Stocks visual language
app.js                data engine, SVG charts, catalogue, D-pad router, persistence
simulator.html        desktop QA harness with additive-display preview
server.js             zero-dependency static server for local dev
scripts/make-icon.js  generates icon.png (PNG encoder, no dependencies)
vercel.json           static hosting config
```
