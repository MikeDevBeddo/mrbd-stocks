/* ==========================================================================
   Stocks — Meta Ray-Ban Display web app
   D-pad only (EMG Neural Band / captouch -> arrow keys + Enter + Escape).

   Watchlist   Up/Down  pick WHICH chart   Left/Right  pick WHICH span
   Detail      Up/Down  step symbol        Left/Right  span
   Edit list   Up/Down  select             Enter       add / remove
   Add stock   Left/Right letter           Enter type  Down results

   The runtime has no text input, so search is an on-screen A-Z rail that
   builds a prefix and filters a bundled catalogue.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------- config -- */

  var CONFIG = {
    /* 'demo'       deterministic offline data, works with zero setup
       'yahoo'      real quotes, NO API key — but Yahoo sends no CORS headers,
                    so a browser cannot call it directly. Point yahooProxy at
                    a proxy that adds them (worker/yahoo-proxy.js deploys one
                    to Cloudflare Workers in ~2 minutes, free, no card).
       'twelvedata' real quotes via apiKey (twelvedata.com free tier) */
    provider: 'yahoo',
    apiKey: '',
    // Base URL that takes a URL-encoded target — deployed from worker/
    yahooProxy: 'https://mrbd-yahoo-proxy.stocks-meta.workers.dev/?url=',
    liveTtlMs: 60 * 1000,
    storageKey: 'mrbd.stocks.v2',

    /* The symbol catalogue CAN be fetched without any key — Twelve Data's
       /stocks reference endpoint is public and sends CORS headers. It is
       pulled lazily (only when Add Stock opens) so it never delays startup,
       and cached for a week. The bundled list below is the instant fallback. */
    catalogSource: 'twelvedata',         // 'bundled' | 'twelvedata'
    catalogExchanges: ['NASDAQ', 'NYSE'],
    catalogTtlMs: 7 * 24 * 60 * 60 * 1000,
    catalogStorageKey: 'mrbd.stocks.catalog.v1'
  };

  /* Symbol catalogue. Only the well-known anchors carry explicit numbers;
     everything else derives plausible demo parameters from its own seed.   */
  var CATALOG = [
    { s: 'AAPL',  n: 'Apple Inc.',                 p: 232.15, pe: 35.4, sh: 15.2e9 },
    { s: 'MSFT',  n: 'Microsoft Corporation',      p: 428.90, pe: 34.8, sh: 7.43e9 },
    { s: 'NVDA',  n: 'NVIDIA Corporation',         p: 121.40, pe: 55.2, sh: 24.6e9 },
    { s: 'GOOGL', n: 'Alphabet Inc.',              p: 178.35, pe: 23.6, sh: 12.3e9 },
    { s: 'AMZN',  n: 'Amazon.com, Inc.',           p: 197.60, pe: 42.1, sh: 10.5e9 },
    { s: 'TSLA',  n: 'Tesla, Inc.',                p: 246.80, pe: 68.9, sh: 3.19e9 },
    { s: 'META',  n: 'Meta Platforms, Inc.',       p: 574.20, pe: 27.4, sh: 2.53e9 },
    { s: 'SPY',   n: 'SPDR S&P 500 ETF Trust',     p: 561.30, pe: 0,    sh: 0 },
    { s: 'QQQ',   n: 'Invesco QQQ Trust',          p: 478.90, pe: 0,    sh: 0 },
    { s: 'DIA',   n: 'SPDR Dow Jones Industrial',  p: 421.60, pe: 0,    sh: 0 },
    { s: 'IWM',   n: 'iShares Russell 2000 ETF',   p: 218.40, pe: 0,    sh: 0 },
    { s: 'VTI',   n: 'Vanguard Total Stock Market', p: 279.10, pe: 0,   sh: 0 },
    { s: 'AMD',   n: 'Advanced Micro Devices' },
    { s: 'INTC',  n: 'Intel Corporation' },
    { s: 'AVGO',  n: 'Broadcom Inc.' },
    { s: 'QCOM',  n: 'QUALCOMM Incorporated' },
    { s: 'TXN',   n: 'Texas Instruments' },
    { s: 'MU',    n: 'Micron Technology' },
    { s: 'ARM',   n: 'Arm Holdings plc' },
    { s: 'SMCI',  n: 'Super Micro Computer' },
    { s: 'ORCL',  n: 'Oracle Corporation' },
    { s: 'CRM',   n: 'Salesforce, Inc.' },
    { s: 'ADBE',  n: 'Adobe Inc.' },
    { s: 'NOW',   n: 'ServiceNow, Inc.' },
    { s: 'IBM',   n: 'International Business Machines' },
    { s: 'CSCO',  n: 'Cisco Systems, Inc.' },
    { s: 'DELL',  n: 'Dell Technologies' },
    { s: 'HPQ',   n: 'HP Inc.' },
    { s: 'NFLX',  n: 'Netflix, Inc.' },
    { s: 'DIS',   n: 'The Walt Disney Company' },
    { s: 'SPOT',  n: 'Spotify Technology' },
    { s: 'UBER',  n: 'Uber Technologies' },
    { s: 'ABNB',  n: 'Airbnb, Inc.' },
    { s: 'SHOP',  n: 'Shopify Inc.' },
    { s: 'PYPL',  n: 'PayPal Holdings' },
    { s: 'SNAP',  n: 'Snap Inc.' },
    { s: 'PINS',  n: 'Pinterest, Inc.' },
    { s: 'COIN',  n: 'Coinbase Global' },
    { s: 'PLTR',  n: 'Palantir Technologies' },
    { s: 'SNOW',  n: 'Snowflake Inc.' },
    { s: 'CRWD',  n: 'CrowdStrike Holdings' },
    { s: 'JPM',   n: 'JPMorgan Chase & Co.' },
    { s: 'BAC',   n: 'Bank of America' },
    { s: 'WFC',   n: 'Wells Fargo & Company' },
    { s: 'GS',    n: 'The Goldman Sachs Group' },
    { s: 'MS',    n: 'Morgan Stanley' },
    { s: 'V',     n: 'Visa Inc.' },
    { s: 'MA',    n: 'Mastercard Incorporated' },
    { s: 'AXP',   n: 'American Express' },
    { s: 'BRK.B', n: 'Berkshire Hathaway Inc.' },
    { s: 'JNJ',   n: 'Johnson & Johnson' },
    { s: 'PFE',   n: 'Pfizer Inc.' },
    { s: 'MRK',   n: 'Merck & Co., Inc.' },
    { s: 'LLY',   n: 'Eli Lilly and Company' },
    { s: 'UNH',   n: 'UnitedHealth Group' },
    { s: 'ABBV',  n: 'AbbVie Inc.' },
    { s: 'TMO',   n: 'Thermo Fisher Scientific' },
    { s: 'XOM',   n: 'Exxon Mobil Corporation' },
    { s: 'CVX',   n: 'Chevron Corporation' },
    { s: 'COP',   n: 'ConocoPhillips' },
    { s: 'WMT',   n: 'Walmart Inc.' },
    { s: 'COST',  n: 'Costco Wholesale' },
    { s: 'TGT',   n: 'Target Corporation' },
    { s: 'HD',    n: 'The Home Depot' },
    { s: 'NKE',   n: 'NIKE, Inc.' },
    { s: 'SBUX',  n: 'Starbucks Corporation' },
    { s: 'MCD',   n: "McDonald's Corporation" },
    { s: 'KO',    n: 'The Coca-Cola Company' },
    { s: 'PEP',   n: 'PepsiCo, Inc.' },
    { s: 'PG',    n: 'Procter & Gamble' },
    { s: 'BA',    n: 'The Boeing Company' },
    { s: 'CAT',   n: 'Caterpillar Inc.' },
    { s: 'GE',    n: 'General Electric' },
    { s: 'F',     n: 'Ford Motor Company' },
    { s: 'GM',    n: 'General Motors' },
    { s: 'RIVN',  n: 'Rivian Automotive' },
    { s: 'LCID',  n: 'Lucid Group' },
    { s: 'T',     n: 'AT&T Inc.' },
    { s: 'VZ',    n: 'Verizon Communications' },
    { s: 'TMUS',  n: 'T-Mobile US' }
  ];

  /* Trading sessions in local exchange time. Yahoo carries every one of these
     under a ticker suffix, so the same adapter serves all of them.
     Holidays are NOT modelled — an exchange shut for a public holiday still
     reads as open here. */
  var MARKETS = [
    { id: 'US',  label: 'US',        tz: 'America/New_York', open: 9 * 60 + 30, close: 16 * 60 },
    { id: 'LSE', label: 'London',    tz: 'Europe/London',    open: 8 * 60,      close: 16 * 60 + 30 },
    { id: 'HKG', label: 'Hong Kong', tz: 'Asia/Hong_Kong',   open: 9 * 60 + 30, close: 16 * 60 },
    { id: 'TYO', label: 'Tokyo',     tz: 'Asia/Tokyo',       open: 9 * 60,      close: 15 * 60 + 30 }
  ];

  var MARKET_SYMBOLS = {
    US: [
      { s: 'AAPL', n: 'Apple Inc.' }, { s: 'MSFT', n: 'Microsoft Corporation' },
      { s: 'NVDA', n: 'NVIDIA Corporation' }, { s: 'GOOGL', n: 'Alphabet Inc.' },
      { s: 'AMZN', n: 'Amazon.com, Inc.' }, { s: 'TSLA', n: 'Tesla, Inc.' },
      { s: 'META', n: 'Meta Platforms, Inc.' }, { s: 'SPY', n: 'SPDR S&P 500 ETF Trust' }
    ],
    LSE: [
      { s: 'AZN.L',  n: 'AstraZeneca PLC' },      { s: 'SHEL.L', n: 'Shell PLC' },
      { s: 'HSBA.L', n: 'HSBC Holdings PLC' },    { s: 'ULVR.L', n: 'Unilever PLC' },
      { s: 'BP.L',   n: 'BP PLC' },               { s: 'RIO.L',  n: 'Rio Tinto PLC' },
      { s: 'GSK.L',  n: 'GSK PLC' },              { s: 'VOD.L',  n: 'Vodafone Group PLC' }
    ],
    HKG: [
      { s: '0700.HK', n: 'Tencent Holdings' },    { s: '9988.HK', n: 'Alibaba Group' },
      { s: '0005.HK', n: 'HSBC Holdings' },       { s: '1299.HK', n: 'AIA Group' },
      { s: '3690.HK', n: 'Meituan' },             { s: '0941.HK', n: 'China Mobile' },
      { s: '1810.HK', n: 'Xiaomi Corporation' },  { s: '2318.HK', n: 'Ping An Insurance' }
    ],
    TYO: [
      { s: '7203.T', n: 'Toyota Motor Corp.' },   { s: '6758.T', n: 'Sony Group Corp.' },
      { s: '9984.T', n: 'SoftBank Group Corp.' }, { s: '8306.T', n: 'Mitsubishi UFJ Financial' },
      { s: '6861.T', n: 'Keyence Corp.' },        { s: '9432.T', n: 'Nippon Telegraph & Telephone' },
      { s: '7974.T', n: 'Nintendo Co., Ltd.' },   { s: '6501.T', n: 'Hitachi, Ltd.' }
    ]
  };

  function defaultsFor(marketId) {
    return MARKET_SYMBOLS[marketId].map(function (e) { return e.s; });
  }

  var RANGES = [
    { id: '1D', bars: 0,    live: ['5min',  78],  yahoo: ['1d',  '5m']  },  // bars 0 -> intraday
    { id: '1W', bars: 5,    live: ['30min', 65],  yahoo: ['5d',  '30m'] },
    { id: '1M', bars: 22,   live: ['1day',  22],  yahoo: ['1mo', '1d']  },
    { id: '6M', bars: 126,  live: ['1day',  126], yahoo: ['6mo', '1d']  },
    { id: '1Y', bars: 252,  live: ['1day',  252], yahoo: ['1y',  '1d']  },
    { id: '5Y', bars: 1260, live: ['1week', 260], yahoo: ['5y',  '1wk'] }
  ];

  var DAILY_BARS = 1260;                 // ~5 trading years

  /* Back navigation is NOT a supported capability on this runtime, so Escape
     may never fire. Every exit must therefore be a cursor target: the rail
     leads with "←", the edit list ends with "Done", and Enter leaves detail. */
  var KEYS = ['←'].concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')).concat(['⌫']);
  var MAX_RESULTS = 40;

  var state = {
    screen: 'watchlist',
    rangeIndex: 2,                       // 1M
    market: 'US',
    selected: 'AAPL',
    detailSymbol: null,
    watchlists: {},                      // marketId -> [symbols]; filled in restore()
    query: '',
    warnedLive: false
  };

  /* state.watchlist is the ACTIVE market's list. Everything downstream reads
     this one property, so switching markets is a single assignment. */
  Object.defineProperty(state, 'watchlist', {
    get: function () {
      if (!state.watchlists[state.market]) {
        state.watchlists[state.market] = defaultsFor(state.market);
      }
      return state.watchlists[state.market];
    },
    set: function (list) { state.watchlists[state.market] = list; }
  });

  var demoCache = {};                    // symbol -> { daily, intraday, meta }
  var metaCache = {};
  var liveCache = {};                    // 'SYM:1M' -> { at, data }
  var liveMeta = {};                     // symbol -> provider meta (real fundamentals)
  var catalogIndex = {};
  var gradSeq = 0;

  var el = {}, screens = {};
  function $(id) { return document.getElementById(id); }

  CATALOG.forEach(function (e) { catalogIndex[e.s] = e; });

  // Non-US listings are searchable too — "7203" or "Toyota" both find it
  Object.keys(MARKET_SYMBOLS).forEach(function (id) {
    MARKET_SYMBOLS[id].forEach(function (e) {
      if (catalogIndex[e.s]) return;
      catalogIndex[e.s] = e;
      CATALOG.push(e);
    });
  });

  /* -------------------------------------------------------------- utils -- */

  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function hashSeed(str) {
    var h = 2166136261, i;
    for (i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // mulberry32 — deterministic, so a symbol always draws the same chart
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeGauss(rand) {
    return function () {
      var u = 1 - rand(), v = rand();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
  }

  function fmtPrice(v) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtSigned(v, digits) {
    var s = Math.abs(v).toFixed(digits === undefined ? 2 : digits);
    return (v >= 0 ? '+' : '−') + s;
  }

  function fmtCompact(v) {
    if (!v) return '—';
    var units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']], i;
    for (i = 0; i < units.length; i++) {
      if (v >= units[i][0]) return (v / units[i][0]).toFixed(2) + units[i][1];
    }
    return String(Math.round(v));
  }

  function isWeekend(d) { var g = d.getDay(); return g === 0 || g === 6; }

  /* Full parameter set for a symbol — curated where known, seeded otherwise. */
  function metaFor(symbol) {
    if (metaCache[symbol]) return metaCache[symbol];
    var e = catalogIndex[symbol] || { s: symbol, n: symbol };
    var r = makeRng(hashSeed(symbol + '|meta'));
    metaCache[symbol] = {
      symbol: e.s,
      name: e.n,
      /* No curated anchor -> every number below is invented. A made-up chart
         under a DEMO badge is the point of the demo; a made-up market cap
         reads as a fact, so those are withheld rather than guessed. */
      derived: e.p === undefined,
      price:  e.p  === undefined ? Math.round((18 + r() * 520) * 100) / 100 : e.p,
      vol:    e.v  === undefined ? 0.18 + r() * 0.34 : e.v,
      drift:  e.d  === undefined ? -0.04 + r() * 0.38 : e.d,
      shares: e.sh === undefined ? Math.round(0.4e9 + r() * 11e9) : e.sh,
      pe:     e.pe === undefined ? Math.round((11 + r() * 44) * 10) / 10 : e.pe,
      avgVol: e.av === undefined ? Math.round(2.5e6 + r() * 78e6) : e.av
    };
    return metaCache[symbol];
  }

  /* ---------------------------------------------------- demo data engine -- */
  /* Deterministic geometric random walk, generated once per symbol and then
     sliced for every range so all ranges stay mutually consistent.          */

  function buildDemo(symbol) {
    if (demoCache[symbol]) return demoCache[symbol];

    var meta = metaFor(symbol);
    var rand = makeRng(hashSeed(symbol));
    var gauss = makeGauss(rand);

    // 1. closes via GBM, then rescaled so the final close hits the anchor price
    var closes = new Array(DAILY_BARS);
    var dt = 1 / 252, x = 1, i;
    for (i = 0; i < DAILY_BARS; i++) {
      x *= Math.exp((meta.drift - 0.5 * meta.vol * meta.vol) * dt +
                    meta.vol * Math.sqrt(dt) * gauss());
      closes[i] = x;
    }
    var scale = meta.price / closes[DAILY_BARS - 1];
    for (i = 0; i < DAILY_BARS; i++) closes[i] *= scale;

    // 2. trading-day timestamps, walking back from today
    var dates = new Array(DAILY_BARS);
    var cursor = new Date();
    cursor.setHours(16, 0, 0, 0);
    for (i = DAILY_BARS - 1; i >= 0; i--) {
      while (isWeekend(cursor)) cursor.setDate(cursor.getDate() - 1);
      dates[i] = cursor.getTime();
      cursor = new Date(cursor.getTime());
      cursor.setDate(cursor.getDate() - 1);
    }

    // 3. OHLCV bars
    var daily = new Array(DAILY_BARS);
    for (i = 0; i < DAILY_BARS; i++) {
      var c = closes[i];
      var prev = i > 0 ? closes[i - 1] : c;
      var o = prev * (1 + gauss() * meta.vol * 0.012);
      var span = Math.abs(gauss()) * meta.vol * 0.011 + 0.002;
      daily[i] = {
        t: dates[i],
        o: o,
        h: Math.max(o, c) * (1 + span),
        l: Math.min(o, c) * (1 - span),
        c: c,
        v: Math.round(meta.avgVol * (0.6 + rand() * 0.9))
      };
    }

    // 4. today's intraday path — Brownian bridge pinned to open and close
    var last = daily[DAILY_BARS - 1];
    var prevClose = daily[DAILY_BARS - 2].c;
    var N = 78, w = new Array(N), acc = 0;
    for (i = 0; i < N; i++) { acc += gauss(); w[i] = acc; }
    var amp = last.c * meta.vol * 0.0016;
    var intraday = new Array(N);
    var open = new Date(last.t);
    open.setHours(9, 30, 0, 0);
    var lo = Infinity, hi = -Infinity;
    for (i = 0; i < N; i++) {
      var f = i / (N - 1);
      var bridge = w[i] - w[N - 1] * f;
      var val = last.o + (last.c - last.o) * f + bridge * amp;
      if (val < lo) lo = val;
      if (val > hi) hi = val;
      intraday[i] = { t: open.getTime() + i * 5 * 60000, c: val };
    }
    last.h = Math.max(last.h, hi);
    last.l = Math.min(last.l, lo);

    demoCache[symbol] = { meta: meta, daily: daily, intraday: intraday, prevClose: prevClose };
    return demoCache[symbol];
  }

  /* Returns { points:[{t,c}], baseline:Number } for a symbol + range. */
  function demoSeries(symbol, rangeIndex) {
    var d = buildDemo(symbol);
    var r = RANGES[rangeIndex];
    if (r.bars === 0) return { points: d.intraday, baseline: d.prevClose };
    var slice = d.daily.slice(Math.max(0, d.daily.length - r.bars)).map(function (b) {
      return { t: b.t, c: b.c };
    });
    return { points: slice, baseline: slice[0].c };
  }

  /* ------------------------------------------------- live data (opt-in) -- */

  function fetchLive(symbol, rangeIndex) {
    var r = RANGES[rangeIndex];
    var url = 'https://api.twelvedata.com/time_series' +
              '?symbol=' + encodeURIComponent(symbol) +
              '&interval=' + r.live[0] +
              '&outputsize=' + r.live[1] +
              '&apikey=' + encodeURIComponent(CONFIG.apiKey);

    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      if (!json || !json.values || !json.values.length) {
        throw new Error(json && json.message ? json.message : 'empty response');
      }
      var points = json.values.map(function (v) {
        return { t: Date.parse(v.datetime.replace(' ', 'T')), c: parseFloat(v.close) };
      }).reverse();
      return { points: points, baseline: points[0].c };
    });
  }

  /* Yahoo's chart endpoint is keyless and complete — price, previous close,
     day high/low, 52-week range and volume all arrive in one response — but it
     sends no CORS headers, so it is only reachable through CONFIG.yahooProxy. */
  function fetchYahoo(symbol, rangeIndex) {
    var r = RANGES[rangeIndex];
    var target = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
                 encodeURIComponent(symbol) +
                 '?range=' + r.yahoo[0] + '&interval=' + r.yahoo[1];

    return fetch(CONFIG.yahooProxy + encodeURIComponent(target)).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      var result = json && json.chart && json.chart.result && json.chart.result[0];
      if (!result) {
        var err = json && json.chart && json.chart.error;
        throw new Error(err && err.description ? err.description : 'no data');
      }

      var quote = result.indicators.quote[0] || {};
      var stamps = result.timestamp || [];
      var closes = quote.close || [];
      var points = [];
      for (var i = 0; i < stamps.length; i++) {
        if (closes[i] === null || closes[i] === undefined) continue;   // market holidays
        points.push({ t: stamps[i] * 1000, c: closes[i] });
      }
      if (points.length < 2) throw new Error('empty series');

      var meta = result.meta || {};

      /* Yahoo omits regularMarketOpen. The first bar of the INTRADAY series is
         the real session open; the first bar of any other range is the open of
         some day weeks ago, so only take it from 1D. */
      if (r.bars === 0) {
        var opens = quote.open || [];
        for (var j = 0; j < opens.length; j++) {
          if (opens[j] !== null && opens[j] !== undefined) { meta.sessionOpen = opens[j]; break; }
        }
      }
      // A 1D chart is measured against the previous close, like Apple Stocks
      var baseline = (r.bars === 0 && isFinite(meta.chartPreviousClose))
        ? meta.chartPreviousClose : points[0].c;

      return { points: points, baseline: baseline, meta: meta };
    });
  }

  /* One request per symbol+range, cached for liveTtlMs, so flicking through
     ranges cannot stampede the network. Returns demo data until the real
     response lands — the screen is never blank and never blocks on a fetch. */
  function cachedLive(symbol, rangeIndex, fetcher) {
    var key = symbol + ':' + RANGES[rangeIndex].id;
    var hit = liveCache[key];
    var fresh = hit && hit.data && Date.now() - hit.at < CONFIG.liveTtlMs;

    if (fresh) return hit.data;

    if (!hit || !hit.pending) {
      liveCache[key] = { at: Date.now(), data: hit ? hit.data : null, pending: true };
      fetcher(symbol, rangeIndex).then(function (data) {
        liveCache[key] = { at: Date.now(), data: data, pending: false };
        // Merge, never replace: sessionOpen only ever arrives with the 1D fetch
        if (data.meta) {
          var into = liveMeta[symbol] || (liveMeta[symbol] = {});
          for (var k in data.meta) {
            if (data.meta[k] !== null && data.meta[k] !== undefined) into[k] = data.meta[k];
          }
        }
        render();
      })['catch'](function (err) {
        liveCache[key] = { at: Date.now(), data: null, pending: false };
        if (!state.warnedLive) {
          state.warnedLive = true;
          showToast('Live data unavailable (' + err.message + ') — showing demo data', 'error');
        }
      });
    }
    return (hit && hit.data) ? hit.data : demoSeries(symbol, rangeIndex);
  }

  /* Facade: demo data is returned immediately so nothing ever renders blank;
     live data (when configured) replaces it in place once it lands.         */
  function getSeries(symbol, rangeIndex) {
    if (CONFIG.provider === 'yahoo' && CONFIG.yahooProxy) {
      return cachedLive(symbol, rangeIndex, fetchYahoo);
    }
    if (CONFIG.provider === 'twelvedata' && CONFIG.apiKey) {
      return cachedLive(symbol, rangeIndex, fetchLive);
    }
    return demoSeries(symbol, rangeIndex);
  }

  function liveActive() {
    return (CONFIG.provider === 'yahoo' && !!CONFIG.yahooProxy) ||
           (CONFIG.provider === 'twelvedata' && !!CONFIG.apiKey);
  }

  function quoteFor(symbol, rangeIndex) {
    var s = getSeries(symbol, rangeIndex);
    var last = s.points[s.points.length - 1].c;

    /* The provider's quote wins over the last bar of the series. Before an
       exchange opens, the newest daily bar is a placeholder carrying the
       previous close, which would show a stale price for the whole session. */
    if (s.meta && isFinite(s.meta.regularMarketPrice) && s.meta.regularMarketPrice > 0) {
      last = s.meta.regularMarketPrice;
    }

    var change = last - s.baseline;
    return {
      series: s,
      price: last,
      change: change,
      pct: s.baseline ? (change / s.baseline) * 100 : 0,
      up: change >= 0
    };
  }

  /* ------------------------------------------------------------- charts -- */

  function chartSvg(w, h, points, baseline, opts) {
    opts = opts || {};
    if (!points || points.length < 2 || w < 4 || h < 4) return '';

    var color = opts.color;
    var padY = opts.padY === undefined ? 10 : opts.padY;
    var n = points.length;
    var lo = Infinity, hi = -Infinity, i, v;

    for (i = 0; i < n; i++) {
      v = points[i].c;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (opts.baseline !== false && isFinite(baseline)) {
      lo = Math.min(lo, baseline);
      hi = Math.max(hi, baseline);
    }
    var span = hi - lo || Math.max(hi * 0.01, 0.01);
    lo -= span * 0.06;
    hi += span * 0.06;

    var innerH = h - padY * 2;
    function X(i2) { return (i2 * (w - 2)) / (n - 1) + 1; }
    function Y(val) { return padY + ((hi - val) / (hi - lo)) * innerH; }

    var line = '';
    for (i = 0; i < n; i++) {
      line += (i === 0 ? 'M' : 'L') + X(i).toFixed(2) + ' ' + Y(points[i].c).toFixed(2);
    }

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h +
              '" aria-hidden="true">';

    if (opts.fill) {
      var gid = 'grad' + (++gradSeq);
      svg += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
             '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.30"/>' +
             '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/>' +
             '</linearGradient></defs>' +
             '<path d="' + line + 'L' + X(n - 1).toFixed(2) + ' ' + h + 'L' + X(0).toFixed(2) +
             ' ' + h + 'Z" fill="url(#' + gid + ')"/>';
    }

    if (opts.baseline !== false && isFinite(baseline)) {
      var by = Y(baseline).toFixed(2);
      svg += '<line x1="0" y1="' + by + '" x2="' + w + '" y2="' + by +
             '" stroke="#FFFFFF" stroke-opacity="0.28" stroke-width="1" stroke-dasharray="3 5"/>';
    }

    svg += '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="' +
           (opts.strokeWidth || 2) + '" stroke-linejoin="round" stroke-linecap="round"/>';

    if (opts.dot) {
      var cx = X(n - 1).toFixed(2), cy = Y(points[n - 1].c).toFixed(2);
      svg += '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="' + color + '" opacity="0.22"/>' +
             '<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="' + color + '"/>';
    }

    return svg + '</svg>';
  }

  // Keep point counts low so the 600x600 surface stays at 60fps
  function downsample(points, max) {
    if (points.length <= max) return points;
    var out = [], step = (points.length - 1) / (max - 1), i;
    for (i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
    return out;
  }

  var varCache = {};
  function getVar(name) {
    if (!varCache[name]) {
      varCache[name] = getComputedStyle(document.documentElement)
        .getPropertyValue(name).trim() || '#FFFFFF';
    }
    return varCache[name];
  }

  function colorFor(up) { return up ? getVar('--up') : getVar('--down'); }

  /* ---------------------------------------------------- watchlist render -- */

  function renderRanges() {
    var html = RANGES.map(function (r, i) {
      return '<div class="chip' + (i === state.rangeIndex ? ' active' : '') + '">' + r.id + '</div>';
    }).join('');
    el.rangeBar.innerHTML = html;
    el.rangeBarDetail.innerHTML = html;
  }

  function buildRows() {
    var html = state.watchlist.map(function (symbol) {
      var m = metaFor(symbol);
      return '<div class="row focusable" tabindex="0" data-action="open" data-symbol="' +
             esc(symbol) + '">' +
               '<div class="row-id">' +
                 '<div class="row-symbol">' + esc(m.symbol) + '</div>' +
                 '<div class="row-name">' + esc(m.name) + '</div>' +
               '</div>' +
               '<div class="row-spark" data-spark="' + esc(symbol) + '"></div>' +
               '<div class="row-quote">' +
                 '<div class="row-price" data-price="' + esc(symbol) + '">—</div>' +
                 '<div class="badge" data-badge="' + esc(symbol) + '">—</div>' +
               '</div>' +
             '</div>';
    }).join('');

    var open = openMarkets();
    var elsewhere = open.filter(function (m) { return m.id !== state.market; });
    html += '<div class="row row-action focusable" tabindex="0" data-action="market">' +
              '<span class="action-label">🌐&nbsp; Market · ' + esc(marketById(state.market).label) +
              (elsewhere.length ? '<em> · ' + esc(elsewhere[0].label) + ' is open</em>' : '') +
            '</span></div>';

    html += '<div class="row row-action focusable" tabindex="0" data-action="edit">' +
            '<span class="action-label">✎&nbsp; Edit List</span></div>';

    el.watchlist.innerHTML = html;
  }

  function renderRows() {
    state.watchlist.forEach(function (symbol) {
      var q = quoteFor(symbol, state.rangeIndex);
      var sel = '[data-spark="' + symbol + '"]';
      var spark = el.watchlist.querySelector(sel);
      if (!spark) return;
      spark.innerHTML = chartSvg(92, 40, downsample(q.series.points, 40), q.series.baseline, {
        color: colorFor(q.up), strokeWidth: 2, padY: 5, baseline: false
      });
      el.watchlist.querySelector('[data-price="' + symbol + '"]').textContent = fmtPrice(q.price);
      var badge = el.watchlist.querySelector('[data-badge="' + symbol + '"]');
      badge.textContent = fmtSigned(q.pct) + '%';
      badge.className = 'badge ' + (q.up ? 'up' : 'down');
    });
  }

  /* ------------------------------------------------------- detail render -- */

  function renderDetail() {
    var m = metaFor(state.detailSymbol);
    var q = quoteFor(state.detailSymbol, state.rangeIndex);
    var d = buildDemo(state.detailSymbol);
    var bar = d.daily[d.daily.length - 1];

    el.detailSymbol.textContent = m.symbol;
    el.detailName.textContent = m.name;
    el.detailPrice.textContent = fmtPrice(q.price);
    el.detailChange.textContent = fmtSigned(q.change) + '  ' + fmtSigned(q.pct) + '%  ' +
                                  RANGES[state.rangeIndex].id;
    el.detailChange.className = 'detail-change ' + (q.up ? 'up' : 'down');

    el.detailChart.innerHTML = chartSvg(
      el.detailChart.clientWidth - 20, el.detailChart.clientHeight - 16,
      downsample(q.series.points, 160), q.series.baseline,
      { color: colorFor(q.up), strokeWidth: 2.5, fill: true, dot: true, padY: 14 }
    );

    var yr = d.daily.slice(-252), hi = -Infinity, lo = Infinity;
    yr.forEach(function (b) { if (b.h > hi) hi = b.h; if (b.l < lo) lo = b.l; });

    /* Never mix sources in one table. Under a live provider every cell comes
       from that provider or reads '—'; falling back to the demo bar once put a
       synthetic open of 124.01 next to a real day range of 217.27-223.63. */
    var cells;
    if (liveActive()) {
      var live = liveMeta[state.detailSymbol] || {};
      /* The session open only rides along with the intraday response, so pull
         1D in the background when the user opened the detail on another range.
         getSeries caches it and re-renders when it lands. */
      if (live.sessionOpen === undefined && state.rangeIndex !== 0) {
        getSeries(state.detailSymbol, 0);
      }
      /* Yahoo reports 0 — not null — for the day's high, low and volume before
         an exchange opens. Rendering "High 0.00" beside a price of 12,036 is
         worse than admitting there is no figure yet. */
      var real = function (value, format) {
        return (value === null || value === undefined || !isFinite(value) || value <= 0)
          ? '—' : format(value);
      };
      cells = [
        ['Open',       real(live.sessionOpen,          fmtPrice)],
        ['Volume',     real(live.regularMarketVolume,  fmtCompact)],
        ['High',       real(live.regularMarketDayHigh, fmtPrice)],
        ['52W H',      real(live.fiftyTwoWeekHigh,     fmtPrice)],
        ['Low',        real(live.regularMarketDayLow,  fmtPrice)],
        ['52W L',      real(live.fiftyTwoWeekLow,      fmtPrice)],
        ['Prev Close', real(live.previousClose,        fmtPrice)],
        /* Currency matters here: London quotes in GBp (pence), so 11850 is
           £118.50, not £11,850. Without it the number misleads. */
        ['Exchange',   (live.fullExchangeName || '—') +
                       (live.currency ? ' · ' + live.currency : '')]
      ];
    } else {
      cells = [
        ['Open',    fmtPrice(bar.o)],
        ['Volume',  fmtCompact(bar.v)],
        ['High',    fmtPrice(bar.h)],
        ['52W H',   fmtPrice(hi)],
        ['Low',     fmtPrice(bar.l)],
        ['52W L',   fmtPrice(lo)],
        ['Mkt Cap', (!m.derived && m.shares) ? fmtCompact(m.shares * q.price) : '—'],
        ['P/E',     (!m.derived && m.pe) ? m.pe.toFixed(1) : '—']
      ];
    }

    el.stats.innerHTML = cells.map(function (c) {
      return '<div class="stat"><span class="stat-label">' + c[0] +
             '</span><span class="stat-value">' + c[1] + '</span></div>';
    }).join('');
  }

  /* --------------------------------------------------------- edit render -- */

  function buildEditList() {
    var html = '<div class="edit-row focusable" tabindex="0" data-action="add">' +
                 '<div class="row-id">' +
                   '<div class="row-symbol accent">＋&nbsp; Add Stock</div>' +
                   '<div class="row-name">' + catalogCountLabel() + '</div>' +
                 '</div></div>';

    html += state.watchlist.map(function (symbol) {
      var m = metaFor(symbol);
      return '<div class="edit-row focusable" tabindex="0" data-action="remove" data-symbol="' +
             esc(symbol) + '">' +
               '<div class="row-id">' +
                 '<div class="row-symbol">' + esc(m.symbol) + '</div>' +
                 '<div class="row-name">' + esc(m.name) + '</div>' +
               '</div>' +
               '<span class="pill remove">⊖ Remove</span>' +
             '</div>';
    }).join('');

    // Escape is not guaranteed on device — "Done" is the reachable way out
    html += '<div class="edit-row focusable" tabindex="0" data-action="done">' +
              '<div class="row-id"><div class="row-symbol muted">←&nbsp; Done</div>' +
              '<div class="row-name">Back to the watchlist</div></div></div>';

    el.editList.innerHTML = html;
    el.editCount.textContent = state.watchlist.length;
  }

  /* ------------------------------------------------------- market render -- */

  function buildMarketList() {
    el.marketList.innerHTML = MARKETS.map(function (m) {
      var now = sessionOf(m);
      var count = (state.watchlists[m.id] || defaultsFor(m.id)).length;
      return '<div class="edit-row focusable" tabindex="0" data-action="market" data-market="' +
             m.id + '">' +
               '<div class="row-id">' +
                 '<div class="row-symbol' + (m.id === state.market ? ' accent' : '') + '">' +
                   esc(m.label) + (m.id === state.market ? ' ✓' : '') + '</div>' +
                 '<div class="row-name">' + count + ' stocks · local ' + now.time + '</div>' +
               '</div>' +
               '<span class="pill ' + (now.open ? 'open' : '') + '">' +
                 (now.open ? '● Open' : 'Closed') + '</span>' +
             '</div>';
    }).join('');

    el.marketList.innerHTML += '<div class="edit-row focusable" tabindex="0" data-action="done">' +
      '<div class="row-id"><div class="row-symbol muted">←&nbsp; Done</div>' +
      '<div class="row-name">Back to the watchlist</div></div></div>';
  }

  function setMarket(id) {
    if (!MARKET_SYMBOLS[id]) return;
    state.market = id;
    if (state.watchlist.indexOf(state.selected) === -1) state.selected = state.watchlist[0];
    persist();
    buildRows();
    openWatchlist(state.selected);
    renderMarketStatus();
    var now = sessionOf(marketById(id));
    showToast(marketById(id).label + (now.open ? ' · open ' + now.time : ' · closed ' + now.time));
  }

  /* ------------------------------------------------------- search render -- */

  function buildKeyrail() {
    el.keyrail.innerHTML = KEYS.map(function (k, i) {
      return '<div class="key focusable" tabindex="-1" data-key-index="' + i + '">' +
             esc(k) + '</div>';
    }).join('');
  }

  function renderQuery() {
    el.query.innerHTML = state.query
      ? esc(state.query) + '<i class="caret">▌</i>'
      : '<i>type a prefix</i>';
  }

  function searchResults() {
    var q = state.query, primary = [], secondary = [], i, w, words;
    for (i = 0; i < CATALOG.length; i++) {
      var e = CATALOG[i];
      if (!q) { primary.push(e); continue; }
      if (e.s.indexOf(q) === 0) { primary.push(e); continue; }
      words = e.n.toUpperCase().split(/[^A-Z0-9]+/);
      for (w = 0; w < words.length; w++) {
        if (words[w] && words[w].indexOf(q) === 0) { secondary.push(e); break; }
      }
    }
    return primary.concat(secondary).slice(0, MAX_RESULTS);
  }

  function renderResults() {
    var results = searchResults();
    if (!results.length) {
      el.results.innerHTML = '<p class="empty">No symbol starts with “' + esc(state.query) +
                             '”.<br>Press <b>⏎</b> on ⌫ to delete a letter.</p>';
      return;
    }
    el.results.innerHTML = results.map(function (e) {
      var added = state.watchlist.indexOf(e.s) !== -1;
      return '<div class="result focusable' + (added ? ' added' : '') +
             '" tabindex="-1" data-symbol="' + esc(e.s) + '">' +
               '<div class="row-id">' +
                 '<div class="row-symbol">' + esc(e.s) + '</div>' +
                 '<div class="row-name">' + esc(e.n) + '</div>' +
               '</div>' +
               '<span class="pill ' + (added ? 'added' : 'add') + '">' +
                 (added ? '✓ In list' : '＋ Add') + '</span>' +
             '</div>';
    }).join('');
  }

  function renderSearchHint() {
    el.searchHint.innerHTML = cursor.zone === 'rail'
      ? '<b>◀▶</b> letter &nbsp;·&nbsp; <b>⏎</b> type &nbsp;·&nbsp; <b>▼</b> results'
      : '<b>▲▼</b> result &nbsp;·&nbsp; <b>⏎</b> add &nbsp;·&nbsp; <b>▲</b> back to letters';
  }

  function render() {
    renderRanges();
    if (state.screen === 'watchlist') renderRows();
    else if (state.screen === 'detail') renderDetail();
  }

  /* ------------------------------------------------------ market status -- */

  function marketById(id) {
    for (var i = 0; i < MARKETS.length; i++) if (MARKETS[i].id === id) return MARKETS[i];
    return MARKETS[0];
  }

  /* Local wall-clock state of one exchange. Holidays are not modelled. */
  function sessionOf(market) {
    try {
      var map = {};
      new Intl.DateTimeFormat('en-US', {
        timeZone: market.tz, hour12: false,
        weekday: 'short', hour: '2-digit', minute: '2-digit'
      }).formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });

      var mins = (parseInt(map.hour, 10) % 24) * 60 + parseInt(map.minute, 10);
      var weekday = map.weekday !== 'Sat' && map.weekday !== 'Sun';
      return {
        time: map.hour + ':' + map.minute,
        open: weekday && mins >= market.open && mins < market.close
      };
    } catch (e) {
      return { time: '--:--', open: false };
    }
  }

  function openMarkets() {
    return MARKETS.filter(function (m) { return sessionOf(m).open; });
  }

  /* Top right: which exchange the list belongs to and whether it is trading. */
  function renderMarketStatus() {
    var market = marketById(state.market);
    var now = sessionOf(market);
    el.marketStatus.className = 'market-status' + (now.open ? ' open' : '');
    el.marketText.textContent = market.label.toUpperCase() + ' · ' +
                                (now.open ? now.time : 'CLOSED ' + now.time);
  }

  /* --------------------------------------------------------------- toast -- */

  var toastTimer = null;
  function showToast(message, type) {
    el.toast.textContent = message;
    el.toast.className = 'toast' + (type === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.className = 'toast hidden'; }, 3000);
  }

  /* ---------------------------------------------------------- navigation -- */

  /* The D-pad cursor lives in app state, NOT in document.activeElement.
     A browser resets activeElement to <body> whenever its frame is blurred
     (clicking anything outside the page, the simulator's own buttons, an OS
     window switch), which would silently strip the cursor and make Enter a
     no-op. DOM focus is still applied for accessibility, but it is a mirror
     of this state, never the source of truth. */
  var cursor = { watchlist: 0, edit: 0, market: 0, results: 0, key: 0, zone: 'rail' };

  function qsa(root, sel) {
    return Array.prototype.slice.call(root.querySelectorAll(sel));
  }

  function cursorNodes(screen) {
    switch (screen) {
      case 'watchlist': return qsa(el.watchlist, '.row');
      case 'edit':      return qsa(el.editList, '.edit-row');
      case 'market':    return qsa(el.marketList, '.edit-row');
      case 'search':    return cursor.zone === 'rail'
                             ? qsa(el.keyrail, '.key')
                             : qsa(el.results, '.result');
      default: return [];
    }
  }

  function cursorIndex(screen) {
    if (screen === 'search') return cursor.zone === 'rail' ? cursor.key : cursor.results;
    return cursor[screen] || 0;
  }

  function setCursorIndex(screen, i) {
    if (screen === 'search') {
      if (cursor.zone === 'rail') cursor.key = i; else cursor.results = i;
    } else {
      cursor[screen] = i;
    }
  }

  /* Paint the cursor and scroll it into view. focus() would otherwise centre
     the row in its scroller and make the list jump, so suppress that. */
  function applyCursor() {
    var nodes = cursorNodes(state.screen);
    var scope = screens[state.screen];
    qsa(scope, '.cursor').forEach(function (n) { n.classList.remove('cursor'); });
    qsa(scope, '.key-active').forEach(function (n) { n.classList.remove('key-active'); });
    if (!nodes.length) return null;

    var i = Math.max(0, Math.min(cursorIndex(state.screen), nodes.length - 1));
    setCursorIndex(state.screen, i);

    var node = nodes[i];
    node.classList.add('cursor');
    try { node.focus({ preventScroll: true }); } catch (e) { /* non-fatal */ }
    node.scrollIntoView({ block: 'nearest' });

    // While the cursor is down in the results, still show which letter is armed
    if (state.screen === 'search' && cursor.zone === 'results') {
      var keys = qsa(el.keyrail, '.key');
      if (keys[cursor.key]) keys[cursor.key].classList.add('key-active');
    }
    return node;
  }

  function currentNode() {
    var nodes = cursorNodes(state.screen);
    return nodes[cursorIndex(state.screen)] || null;
  }

  /* Remembers where the cursor was so the app reopens on the same stock. */
  function syncSelection() {
    var node = currentNode();
    if (!node) return;
    var symbol = node.getAttribute('data-symbol');
    if (!symbol || symbol === state.selected) return;
    state.selected = symbol;
    persist();
  }

  function moveCursor(delta) {
    var nodes = cursorNodes(state.screen);
    if (!nodes.length) return;
    var i = cursorIndex(state.screen);
    setCursorIndex(state.screen, (i + delta + nodes.length) % nodes.length);
    applyCursor();
    if (state.screen === 'watchlist') syncSelection();
  }

  function setRange(delta) {
    state.rangeIndex = (state.rangeIndex + delta + RANGES.length) % RANGES.length;
    persist();
    render();
  }

  function showScreen(name) {
    Object.keys(screens).forEach(function (n) {
      screens[n].classList.toggle('hidden', n !== name);
    });
    state.screen = name;
  }

  function pointCursorAt(symbol) {
    var i = state.watchlist.indexOf(symbol);
    cursor.watchlist = i === -1 ? 0 : i;
  }

  function openWatchlist(symbol) {
    showScreen('watchlist');
    if (symbol) pointCursorAt(symbol);
    render();
    applyCursor();
    syncSelection();
  }

  function openDetail(symbol) {
    state.detailSymbol = symbol;
    showScreen('detail');
    renderDetail();
    renderRanges();
  }

  function openEdit() {
    showScreen('edit');
    buildEditList();
    cursor.edit = 0;
    applyCursor();
  }

  function openMarketPicker() {
    showScreen('market');
    buildMarketList();
    cursor.market = Math.max(0, MARKETS.map(function (m) { return m.id; }).indexOf(state.market));
    applyCursor();
  }

  function openSearch() {
    showScreen('search');
    // Always start clean — a stale prefix from last time reads as "no results"
    state.query = '';
    cursor.zone = 'rail';
    cursor.key = 0;
    cursor.results = 0;
    renderQuery();
    renderResults();
    renderSearchHint();
    applyCursor();
    ensureCatalog();
  }

  function stepDetailSymbol(delta) {
    var i = state.watchlist.indexOf(state.detailSymbol);
    if (i === -1) i = 0;
    state.detailSymbol = state.watchlist[
      (i + delta + state.watchlist.length) % state.watchlist.length
    ];
    renderDetail();
  }

  /* ------------------------------------------------------ add and remove -- */

  function addSymbol(symbol) {
    if (state.watchlist.indexOf(symbol) !== -1) {
      showToast(symbol + ' is already in your list');
      return;
    }
    // Prepend, not append: a stock added to the foot of a scrolling list is
    // easy to lose track of, and its Remove row ends up equally buried.
    state.watchlist.unshift(symbol);
    state.selected = symbol;
    persist();
    buildRows();
    openWatchlist(symbol);
    showToast(symbol + ' added to watchlist');
  }

  function removeSymbol(symbol) {
    var i = state.watchlist.indexOf(symbol);
    if (i === -1) return;
    if (state.watchlist.length <= 1) {
      showToast('Keep at least one stock in the list', 'error');
      return;
    }
    state.watchlist.splice(i, 1);
    if (state.selected === symbol) {
      state.selected = state.watchlist[Math.min(i, state.watchlist.length - 1)];
    }
    persist();
    buildRows();
    pointCursorAt(state.selected);

    // Rebuild the edit list and keep the cursor where the removed row was
    // (+1 because the "Add Stock" entry occupies index 0)
    buildEditList();
    cursor.edit = Math.min(i + 1, state.watchlist.length);
    applyCursor();
    showToast(symbol + ' removed');
  }

  /* ---------------------------------------------------- symbol catalogue -- */

  var catalogLoaded = false, catalogLoading = false;

  // Instruments a watchlist app has any business showing
  var KEEP_TYPES = {
    'Common Stock': 1, 'ETF': 1, 'REIT': 1,
    'American Depositary Receipt': 1, 'Depositary Receipt': 1
  };

  function catalogCountLabel() {
    return 'Search ' + CATALOG.length.toLocaleString('en-US') + ' symbols with the D-pad';
  }

  /* The edit list may already be on screen when a fetched catalogue lands. */
  function refreshCatalogCount() {
    var node = el.editList.querySelector('[data-action="add"] .row-name');
    if (node) node.textContent = catalogCountLabel();
  }

  function mergeCatalog(list) {
    var added = 0, i, e;
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (!e || !e.s || catalogIndex[e.s]) continue;
      catalogIndex[e.s] = e;
      CATALOG.push(e);
      added++;
    }
    if (added) {
      CATALOG.sort(function (a, b) { return a.s < b.s ? -1 : (a.s > b.s ? 1 : 0); });
    }
    return added;
  }

  function fetchCatalog() {
    return Promise.all(CONFIG.catalogExchanges.map(function (x) {
      return fetch('https://api.twelvedata.com/stocks?exchange=' + encodeURIComponent(x) +
                   '&country=' + encodeURIComponent('United States'))
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        });
    })).then(function (parts) {
      var seen = {}, out = [];
      parts.forEach(function (p) {
        var rows = p && p.data ? p.data : [];
        rows.forEach(function (row) {
          if (!row.symbol || seen[row.symbol]) return;
          if (row.type && !KEEP_TYPES[row.type]) return;
          seen[row.symbol] = 1;
          out.push({ s: row.symbol, n: row.name || row.symbol });
        });
      });
      if (!out.length) throw new Error('empty catalogue');
      return out;
    });
  }

  /* Cheap and synchronous — a cached catalogue costs no network, so read it
     at startup and the symbol count is honest from the first frame. */
  function hydrateCatalogFromCache() {
    if (CONFIG.catalogSource !== 'twelvedata') return;
    try {
      var cached = JSON.parse(localStorage.getItem(CONFIG.catalogStorageKey) || 'null');
      if (cached && cached.list && Date.now() - cached.at < CONFIG.catalogTtlMs) {
        mergeCatalog(cached.list);
        catalogLoaded = true;
      }
    } catch (e) { /* unreadable cache — the network path will refill it */ }
  }

  /* The network pull stays lazy: only when Add Stock opens. */
  function ensureCatalog() {
    if (CONFIG.catalogSource !== 'twelvedata' || catalogLoaded || catalogLoading) return;
    catalogLoading = true;
    fetchCatalog().then(function (list) {
      catalogLoading = false;
      catalogLoaded = true;
      var added = mergeCatalog(list);
      try {
        localStorage.setItem(CONFIG.catalogStorageKey,
                             JSON.stringify({ at: Date.now(), list: list }));
      } catch (e) { /* over quota — the in-memory merge still stands */ }
      renderResults();
      refreshCatalogCount();
      if (added) showToast(CATALOG.length.toLocaleString('en-US') + ' symbols available');
    })['catch'](function () {
      catalogLoading = false;
      showToast('Symbol catalogue unavailable — using the built-in list', 'error');
    });
  }

  /* -------------------------------------------------------- search input -- */

  function typeKey() {
    var k = KEYS[cursor.key];
    if (k === '←') {
      openEdit();
      return;
    }
    if (k === '⌫') {
      if (!state.query) return;
      state.query = state.query.slice(0, -1);
    } else {
      if (state.query.length >= 6) return;
      state.query += k;
    }
    renderQuery();
    renderResults();
    cursor.results = 0;
  }

  function enterResults() {
    if (!el.results.querySelectorAll('.result').length) {
      showToast('No results to select');
      return;
    }
    cursor.zone = 'results';
    cursor.results = 0;
    renderSearchHint();
    applyCursor();
  }

  function backToRail() {
    cursor.zone = 'rail';
    renderSearchHint();
    applyCursor();
  }

  /* --------------------------------------------------------- persistence -- */

  function persist() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        rangeIndex: state.rangeIndex,
        market: state.market,
        selected: state.selected,
        watchlists: state.watchlists
      }));
    } catch (e) { /* storage full or blocked — non-fatal */ }
  }

  function restore() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(CONFIG.storageKey) || 'null'); }
    catch (e) { /* ignore malformed state */ }

    var isArray = function (v) { return Object.prototype.toString.call(v) === '[object Array]'; };
    var clean = function (list) {
      return list.filter(function (s) { return typeof s === 'string' && s; });
    };

    if (saved) {
      if (saved.watchlists && typeof saved.watchlists === 'object') {
        Object.keys(MARKET_SYMBOLS).forEach(function (id) {
          if (isArray(saved.watchlists[id]) && saved.watchlists[id].length) {
            state.watchlists[id] = clean(saved.watchlists[id]);
          }
        });
      } else if (isArray(saved.watchlist) && saved.watchlist.length) {
        state.watchlists.US = clean(saved.watchlist);   // pre-markets format
      }
      if (MARKET_SYMBOLS[saved.market]) state.market = saved.market;
      if (typeof saved.rangeIndex === 'number' &&
          saved.rangeIndex >= 0 && saved.rangeIndex < RANGES.length) {
        state.rangeIndex = saved.rangeIndex;
      }
    }

    /* Land on an exchange that is actually trading. Only at startup — never
       yank the list out from under someone mid-session. */
    if (!sessionOf(marketById(state.market)).open) {
      var trading = openMarkets();
      if (trading.length) state.market = trading[0].id;
    }

    state.selected = (saved && state.watchlist.indexOf(saved.selected) !== -1)
      ? saved.selected : state.watchlist[0];
  }

  /* --------------------------------------------------------------- input -- */

  var DPAD = {
    UP: 'ArrowUp', DOWN: 'ArrowDown',
    LEFT: 'ArrowLeft', RIGHT: 'ArrowRight',
    SELECT: 'Enter', BACK: 'Escape'
  };

  function activateWatchlist() {
    var node = currentNode();
    if (!node) return;
    var action = node.getAttribute('data-action');
    if (action === 'edit') openEdit();
    else if (action === 'market') openMarketPicker();
    else if (node.getAttribute('data-symbol')) openDetail(node.getAttribute('data-symbol'));
  }

  function activateMarket() {
    var node = currentNode();
    if (!node) return;
    if (node.getAttribute('data-action') === 'done') { openWatchlist(); return; }
    var id = node.getAttribute('data-market');
    if (id) setMarket(id);
  }

  function activateEdit() {
    var node = currentNode();
    if (!node) return;
    var action = node.getAttribute('data-action');
    if (action === 'add') openSearch();
    else if (action === 'done') openWatchlist();
    else removeSymbol(node.getAttribute('data-symbol'));
  }

  function activateSearch() {
    if (cursor.zone === 'rail') { typeKey(); return; }
    var node = currentNode();
    if (node && node.getAttribute('data-symbol')) addSymbol(node.getAttribute('data-symbol'));
  }

  function handlers(key) {
    switch (state.screen) {

      case 'watchlist':
        switch (key) {
          case DPAD.UP:     moveCursor(-1); return true;
          case DPAD.DOWN:   moveCursor(1);  return true;
          case DPAD.LEFT:   setRange(-1);   return true;
          case DPAD.RIGHT:  setRange(1);    return true;
          case DPAD.SELECT: activateWatchlist(); return true;
          case DPAD.BACK:   history.back(); return true;
        }
        return false;

      case 'detail':
        switch (key) {
          case DPAD.UP:     stepDetailSymbol(-1); return true;
          case DPAD.DOWN:   stepDetailSymbol(1);  return true;
          case DPAD.LEFT:   setRange(-1);         return true;
          case DPAD.RIGHT:  setRange(1);          return true;
          // Nothing on this screen is activatable, so Enter is the way out —
          // Escape cannot be relied on (back navigation is unsupported).
          case DPAD.SELECT:
          case DPAD.BACK:   openWatchlist(state.detailSymbol); return true;
        }
        return false;

      case 'edit':
        switch (key) {
          case DPAD.UP:     moveCursor(-1); return true;
          case DPAD.DOWN:   moveCursor(1);  return true;
          case DPAD.SELECT: activateEdit(); return true;
          case DPAD.BACK:   openWatchlist(); return true;
        }
        return false;

      case 'market':
        switch (key) {
          case DPAD.UP:     moveCursor(-1);   return true;
          case DPAD.DOWN:   moveCursor(1);    return true;
          case DPAD.SELECT: activateMarket(); return true;
          case DPAD.BACK:   openWatchlist();  return true;
        }
        return false;

      case 'search':
        switch (key) {
          case DPAD.LEFT:
            if (cursor.zone === 'rail') moveCursor(-1);
            return true;
          case DPAD.RIGHT:
            if (cursor.zone === 'rail') moveCursor(1);
            return true;
          case DPAD.DOWN:
            if (cursor.zone === 'rail') enterResults();
            else if (cursor.results < el.results.querySelectorAll('.result').length - 1) {
              moveCursor(1);
            }
            return true;
          case DPAD.UP:
            if (cursor.zone === 'results') {
              if (cursor.results <= 0) backToRail();
              else moveCursor(-1);
            }
            return true;
          case DPAD.SELECT: activateSearch(); return true;
          case DPAD.BACK:   openEdit();       return true;
        }
        return false;
    }
    return false;
  }

  function onKeyDown(e) {
    if (handlers(e.key)) e.preventDefault();
  }

  /* ---------------------------------------------------------------- init -- */

  function init() {
    screens.watchlist = $('screen-watchlist');
    screens.detail    = $('screen-detail');
    screens.edit      = $('screen-edit');
    screens.market    = $('screen-market');
    screens.search    = $('screen-search');

    el.rangeBar       = $('range-bar');
    el.rangeBarDetail = $('range-bar-detail');
    el.watchlist      = $('watchlist');
    el.detailSymbol   = $('detail-symbol');
    el.detailName     = $('detail-name');
    el.detailPrice    = $('detail-price');
    el.detailChange   = $('detail-change');
    el.detailChart    = $('detail-chart');
    el.stats          = $('stats');
    el.editList       = $('edit-list');
    el.editCount      = $('edit-count');
    el.marketList     = $('market-list');
    el.keyrail        = $('keyrail');
    el.query          = $('query');
    el.results        = $('results');
    el.searchHint     = $('search-hint');
    el.marketStatus   = $('market-status');
    el.marketText     = $('market-text');
    el.dataBadge      = $('data-badge');
    el.toast          = $('toast');

    /* Escape hatch: set the proxy from the device without redeploying —
         localStorage.setItem('mrbd.yahooProxy', 'https://…workers.dev/?url=')
       Editing CONFIG above is the permanent way; this is for trying a proxy
       on the glasses, where there is no way to edit a file. */
    try {
      var saved = localStorage.getItem('mrbd.yahooProxy');
      if (saved) { CONFIG.yahooProxy = saved; CONFIG.provider = 'yahoo'; }
    } catch (e) { /* storage blocked — keep the compiled-in config */ }

    var isLive = liveActive();
    el.dataBadge.textContent = isLive ? 'LIVE' : 'DEMO';
    el.dataBadge.className = 'data-badge' + (isLive ? ' live' : '');

    restore();
    hydrateCatalogFromCache();
    buildRows();
    buildKeyrail();

    /* Mouse support exists only for desktop QA — the glasses have no cursor.
       A click moves the D-pad cursor to that node, then activates it. */
    function clickTarget(container, selector, screen, activate) {
      container.addEventListener('click', function (e) {
        var node = e.target.closest ? e.target.closest(selector) : null;
        if (!node) return;
        var index = qsa(container, selector).indexOf(node);
        if (index === -1) return;
        if (screen === 'search') cursor.zone = node.classList.contains('key') ? 'rail' : 'results';
        setCursorIndex(screen, index);
        applyCursor();
        activate();
      });
    }

    clickTarget(el.watchlist, '.row', 'watchlist', function () {
      syncSelection();
      activateWatchlist();
    });
    clickTarget(el.editList, '.edit-row', 'edit', activateEdit);
    clickTarget(el.marketList, '.edit-row', 'market', activateMarket);
    clickTarget(el.results, '.result', 'search', activateSearch);
    clickTarget(el.keyrail, '.key', 'search', activateSearch);

    document.addEventListener('keydown', onKeyDown);

    render();
    renderMarketStatus();
    setInterval(renderMarketStatus, 30000);

    pointCursorAt(state.selected);
    applyCursor();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
