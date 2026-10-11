/* CarbonChain demo fixtures.
 *
 * Everything the UI shows in demo mode lives here: the seeded sales history, buyer portfolio, escrow
 * states, bounty results and recent security events. app.js calls CC_MOCK.seed() once at start-up.
 *
 * Connecting AWS later means replacing these fixtures with API responses of the same shape
 * (GET /api/projects, GET /api/portfolio, POST /api/orders ...); nothing else in the UI needs to change.
 *
 * Session changes (purchases, retirements, escrow unlocks, watchlist) are kept in localStorage under
 * `cc_demo_state` so reloads stay consistent. CC_MOCK.reset() returns to the seeded baseline.
 * All people, companies and wallets below are fictional.
 */
(function () {
  'use strict';

  var STORE_KEY = 'cc_demo_state';
  var STORE_VER = 3;
  var DAY = 864e5;

  // ── deterministic helpers ────────────────────────────────────────────────
  function rng(seed) { // mulberry32
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hex(rnd, n) { var s = ''; while (s.length < n) s += Math.floor(rnd() * 16).toString(16); return s; }
  function pad3(n) { return String(n).padStart(3, '0'); }
  function ymd(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function round(n, d) { var f = Math.pow(10, d); return Math.round(n * f) / f; }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }

  // ── fixtures ─────────────────────────────────────────────────────────────
  var SELLER = { id: 'usr_sell001', name: 'GreenEarth Pvt Ltd' };
  var SELLER_PROJECTS = { p1: 70, p4: 64, p6: 58 }; // project id -> listed N days ago

  var BUYERS = {
    arjun:     { id: 'usr_buyer001', name: 'Arjun Sharma',            wallet: '0x742d35Cc6634C0532925a3b8D4C9C1C3a6b8F2e1' },
    kaveri:    { id: 'corp_kaveri',  name: 'Kaveri Textiles Pvt Ltd', seed: 101 },
    blueorbit: { id: 'corp_blueorb', name: 'BlueOrbit Airlines',      seed: 102 },
    himalaya:  { id: 'corp_himal',   name: 'Himalaya Foods Pvt Ltd',  seed: 103 },
    bharat:    { id: 'corp_bharat',  name: 'Bharat Green Logistics',  seed: 104 }
  };

  // [days ago, buyer, project, credits]; per-project sums equal (total - available) so supply stays consistent
  var SALES = [
    [52, 'kaveri', 'p1', 150], [47, 'blueorbit', 'p1', 120], [41, 'arjun', 'p1', 12],
    [33, 'himalaya', 'p1', 80], [26, 'blueorbit', 'p1', 100], [14, 'bharat', 'p1', 38],
    [44, 'himalaya', 'p4', 120], [38, 'kaveri', 'p4', 60], [29, 'arjun', 'p4', 9], [19, 'bharat', 'p4', 111],
    [36, 'blueorbit', 'p6', 90], [22, 'kaveri', 'p6', 60], [11, 'arjun', 'p6', 3],
    [5, 'bharat', 'p6', 27], [0, 'bharat', 'p6', 20]
  ];
  // Arjun's credits per project that he has already retired (the rest he still holds)
  var ARJUN_RETIRED = { p1: 4, p4: 3, p6: 3 };

  var WATCHLIST = ['p2', 'p5'];

  var VERIFIED_BOUNTIES = [
    { id: 'BS005', name: 'Nilgiri Biosphere Sapling Plots', location: 'Tamil Nadu, India', coords: '11.4064° N, 76.6932° E', parcelId: 'PARCEL-TN-005', status: 'verified', reward: '0.005 ETH', type: '🌲 Shola Forest', confidence: 96, auditor: '0x9aC1e4B7d2F08a3c5E61b9D4a7F2c8E0b3A6d915', paidTx: '0x' + hex(rng(901), 64), verifiedDaysAgo: 3 },
    { id: 'BS006', name: 'Kutch Mangrove Nursery', location: 'Gujarat, India', coords: '23.2420° N, 68.8210° E', parcelId: 'PARCEL-GJ-006', status: 'verified', reward: '0.005 ETH', type: '🌿 Mangrove', confidence: 93, auditor: '0x4dE7a19C3b5F602e8A1d7c9B0f3E5a2D6c8B1f47', paidTx: '0x' + hex(rng(902), 64), verifiedDaysAgo: 9 }
  ];

  // ── seeding ──────────────────────────────────────────────────────────────
  function buyerWallet(key) {
    var b = BUYERS[key];
    return b.wallet || ('0x' + hex(rng(b.seed), 40));
  }

  function baseline(ctx) {
    var db = ctx.db, projects = ctx.MOCK_PROJECTS, ledger = ctx.TOKEN_LEDGER, truncate = ctx.truncate;
    var now = Date.now();
    var byId = {}; projects.forEach(function (p) { byId[p.id] = p; });

    // the demo seller owns three projects (fixes the old seller_name mismatch)
    Object.keys(SELLER_PROJECTS).forEach(function (id) {
      var p = byId[id]; if (!p) return;
      p.seller_name = SELLER.name; p.seller_id = SELLER.id;
      p.created_at = new Date(now - SELLER_PROJECTS[id] * DAY).toISOString();
    });

    db.transactions = []; db.holdings = []; db.watchlist = [];
    var arjunWallet = BUYERS.arjun.wallet, arjunShort = truncate(arjunWallet);
    var tokenNo = 1, spentByArjun = 0, heldByProject = {};

    SALES.forEach(function (row, i) {
      var daysAgo = row[0], key = row[1], pid = row[2], credits = row[3], p = byId[pid], b = BUYERS[key];
      if (!p) return;
      var when = daysAgo === 0 ? now - 60000 : now - daysAgo * DAY - ((i * 37) % 600) * 60000;
      var total = round(credits * p.price_per_credit, 6);
      var txHash = '0x' + hex(rng(500 + i), 64);
      var tx = {
        id: 'tx_seed_' + (i + 1), blockchain_tx: txHash, project_id: pid, project_name: p.name,
        buyer_id: b.id, buyer_name: b.name, buyer_wallet: buyerWallet(key),
        seller_name: p.seller_name || '', seller_id: p.seller_id || '',
        credits: credits, total_amount: total.toFixed(6), seller_payout: (total * 0.975).toFixed(6), platform_fee: (total * 0.025).toFixed(6),
        price_per_credit: p.price_per_credit, project_type: p.type, project_location: p.location || '',
        status: 'confirmed', created_at: new Date(when).toISOString(), token_ids: []
      };
      if (key === 'arjun') {
        spentByArjun += total;
        var retire = ARJUN_RETIRED[pid] || 0;
        for (var k = 0; k < credits; k++) {
          var id = 'CC-N' + pad3(tokenNo++), burned = k < retire;
          ledger.push({
            id: id, projectId: pid, projectName: p.name, projectType: p.type,
            owner: burned ? 'BURNED' : arjunShort, status: burned ? 'retired' : 'active',
            vintage: p.vintage_year, mintedAt: ymd(when), txHash: txHash,
            prevOwners: burned ? [arjunShort] : [p.seller_name ? p.seller_name.slice(0, 8) + '...0x' : '0x...'],
            retiredAt: burned ? ymd(when + 3 * DAY) : undefined, retireTxHash: burned ? '0x' + hex(rng(700 + tokenNo), 64) : undefined
          });
          tx.token_ids.push(id);
        }
        heldByProject[pid] = (heldByProject[pid] || 0) + (credits - retire);
      }
      db.transactions.push(tx);
    });

    Object.keys(heldByProject).forEach(function (pid) {
      if (heldByProject[pid] > 0) db.holdings.push({ userId: BUYERS.arjun.id, projectId: pid, credits: heldByProject[pid], project: byId[pid] });
    });
    WATCHLIST.forEach(function (pid) { db.watchlist.push({ userId: BUYERS.arjun.id, projectId: pid }); });

    // escrow: p1 awaiting NDVI (no record), p4 released, p6 locked
    var payoutFor = function (pid) {
      return db.transactions.filter(function (t) { return t.project_id === pid; })
        .reduce(function (s, t) { return s + parseFloat(t.total_amount) * 0.975; }, 0);
    };
    ctx.state.escrows = { p4: { released: true, amount: 0 }, p6: { released: false, amount: round(payoutFor('p6') * 0.7, 4) } };

    // demo buyer wallet balances reflect what the history cost
    var held = db.holdings.reduce(function (s, h) { return s + h.credits; }, 0);
    var u = db.users['buyer@demo.com'];
    if (u) { u.eth_balance = round(5.0 - spentByArjun, 4); u.credit_balance = held; }
  }

  // ── persistence ──────────────────────────────────────────────────────────
  function restore(ctx) {
    var raw; try { raw = localStorage.getItem(STORE_KEY); } catch (_) { return false; }
    if (!raw) return false;
    try {
      var s = JSON.parse(raw);
      if (!s || s.v !== STORE_VER) return false;
      var swap = function (arr, items) { arr.splice.apply(arr, [0, arr.length].concat(items)); };
      swap(ctx.MOCK_PROJECTS, s.projects); swap(ctx.TOKEN_LEDGER, s.ledger);
      Object.assign(ctx.EVIDENCE_VAULT, s.evidence || {});
      ctx.db.transactions = s.transactions; ctx.db.watchlist = s.watchlist;
      ctx.db.holdings = s.holdings.map(function (h) {
        h.project = ctx.MOCK_PROJECTS.filter(function (p) { return p.id === h.projectId; })[0]; return h;
      });
      ctx.state.escrows = s.escrows || {};
      Object.keys(s.balances || {}).forEach(function (email) { if (ctx.db.users[email]) Object.assign(ctx.db.users[email], s.balances[email]); });
      return true;
    } catch (e) { return false; }
  }

  function save(ctx) {
    try {
      var balances = {};
      Object.keys(ctx.MOCK_USERS).forEach(function (email) {
        var u = ctx.db.users[email]; if (u) balances[email] = { eth_balance: u.eth_balance, credit_balance: u.credit_balance };
      });
      var cur = ctx.state.user; // a live session user may be a different object from db.users[email]
      if (cur && balances[cur.email]) balances[cur.email] = { eth_balance: cur.eth_balance, credit_balance: cur.credit_balance };
      localStorage.setItem(STORE_KEY, JSON.stringify({
        v: STORE_VER, projects: ctx.MOCK_PROJECTS, ledger: ctx.TOKEN_LEDGER, evidence: ctx.EVIDENCE_VAULT,
        transactions: ctx.db.transactions, watchlist: ctx.db.watchlist, escrows: ctx.state.escrows || {}, balances: balances,
        holdings: ctx.db.holdings.map(function (h) { return { userId: h.userId, projectId: h.projectId, credits: h.credits }; })
      }));
    } catch (_) { /* storage full or unavailable: demo still works for this session */ }
  }

  // ── always-run adjustments ───────────────────────────────────────────────
  function finish(ctx) {
    var now = Date.now();
    // security log: keep the events looking recent
    (ctx.MOCK_SECURITY_EVENTS || []).forEach(function (e, i) {
      e.created_at = new Date(now - (i * 53 + 7) * 60000).toISOString().slice(0, 19);
    });
    // bounty board: add two completed verifications next to the open sites
    if (!ctx.BOUNTY_SITES.some(function (s) { return s.status === 'verified'; })) {
      VERIFIED_BOUNTIES.forEach(function (b) {
        var copy = Object.assign({}, b); copy.verifiedAt = ymd(now - b.verifiedDaysAgo * DAY); ctx.BOUNTY_SITES.push(copy);
      });
    }
    // a restored browser session holds a copy of the user; point it at the live account object
    var cur = ctx.state.user, live = cur && ctx.db.users[cur.email];
    if (live && live !== cur) {
      ctx.state.user = live;
      try { localStorage.setItem('cc_user', JSON.stringify(live)); } catch (_) { }
    }
    updateHero(ctx.MOCK_PROJECTS);
    decorate();
  }

  function updateHero(projects) {
    var avail = 0, sold = 0, volume = 0;
    projects.forEach(function (p) {
      var s = Math.max(0, (p.total_credits || 0) - (p.available_credits || 0));
      avail += p.available_credits || 0; sold += s; volume += s * (p.price_per_credit || 0);
    });
    var set = function (id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; };
    set('stat-listings', fmt(avail) + ' <span>credits</span>');
    set('stat-volume', volume.toFixed(1) + ' <span>ETH</span>');
    set('stat-co2', fmt(sold) + ' <span>tonnes</span>');
  }

  function isDemoMode() { return !(window.CC_CONFIG && window.CC_CONFIG.API_URL); }

  function decorate() {
    if (!isDemoMode()) return;
    var pill = document.getElementById('demoPill');
    if (pill) pill.hidden = false;
    if (document.querySelector('.demo-footer')) return;
    var foot = document.createElement('div');
    foot.className = 'demo-footer';
    foot.innerHTML = 'Simulated data for demonstration &middot; <a href="#" onclick="CC_MOCK.reset();return false;">Reset demo data</a>';
    document.body.appendChild(foot);
  }

  window.CC_MOCK = {
    rng: rng,
    hex: hex,
    seed: function (ctx) { var restored = restore(ctx); if (!restored) baseline(ctx); finish(ctx); return restored ? 'restored' : 'seeded'; },
    save: save,
    updateHero: updateHero,
    reset: function () { try { localStorage.removeItem(STORE_KEY); } catch (_) { } location.reload(); }
  };
})();
