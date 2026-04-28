/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  sas-guard.js — Secure Access System client integration    ║
 * ║                                                            ║
 * ║  1. Copy this file to your project's public/static folder  ║
 * ║  2. Set SAS_URL below to your Vercel deployment URL        ║
 * ║  3. Add to every page you want protected (first in <head>):║
 * ║       <script src="/sas-guard.js"></script>                ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

(function () {
  'use strict';

  /* ── CONFIG ─────────────────────────────── */
  var SAS_URL      = 'https://YOUR-SAS.vercel.app'; // ← your SAS URL (no trailing slash)
  var BLOCKED_PATH = '/blocked.html';               // blocked page on YOUR site (or null for inline)
  var SHOW_BADGE   = true;                          // session countdown badge
  /* ─────────────────────────────────────────── */

  var VERIFY_URL  = SAS_URL + '/api/verify';
  var GATEWAY_URL = SAS_URL + '/api/gateway';
  var TOKEN_KEY   = 'sas_token';
  var FLAG_KEY    = 'sas_redirected'; // loop detection flag

  /* Current page URL, stripped of sas_token param */
  var pageUrl = (function () {
    var p = new URLSearchParams(window.location.search);
    p.delete('sas_token');
    return window.location.origin + window.location.pathname + (p.toString() ? '?' + p.toString() : '');
  })();

  /* ── Step 1: hide immediately to prevent flash ── */
  document.documentElement.style.visibility = 'hidden';

  /* ── Step 2: grab token from URL if gateway just returned ── */
  var urlParams  = new URLSearchParams(window.location.search);
  var freshToken = urlParams.get('sas_token');

  if (freshToken) {
    _store(TOKEN_KEY, freshToken);          // save BEFORE stripping URL
    urlParams.delete('sas_token');
    var qs = urlParams.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''));
    _store(FLAG_KEY, null);                 // clear loop flag on fresh token
  }

  /* ── Step 3: get stored token ── */
  var token = freshToken || _load(TOKEN_KEY);

  /* ── Step 4: no token → redirect to gateway (with loop guard) ── */
  if (!token) {
    if (_load(FLAG_KEY) === '1') {
      _store(FLAG_KEY, null);
      _blocked('no_token');
    } else {
      _store(FLAG_KEY, '1');
      window.location.replace(GATEWAY_URL + '?return=' + encodeURIComponent(pageUrl));
    }
    return;
  }

  /* ── Step 5: verify ── */
  _verify(token);

  /* ════════════════════════════════════════════════
   *  Functions
   * ════════════════════════════════════════════════ */

  function _verify(tok) {
    fetch(VERIFY_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({ token: tok }),
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data && data.success) {
        _store(FLAG_KEY, null);
        document.documentElement.style.visibility = 'visible';
        if (SHOW_BADGE) _badge(data.session);
      } else {
        _store(TOKEN_KEY, null);
        /* Loop guard: only retry once */
        if (_load(FLAG_KEY) === '1') {
          _store(FLAG_KEY, null);
          _blocked(data.reason || 'invalid_token');
        } else {
          _store(FLAG_KEY, '1');
          window.location.replace(GATEWAY_URL + '?return=' + encodeURIComponent(pageUrl));
        }
      }
    })
    .catch(function () {
      /* Network error → show page to avoid locking out on SAS downtime */
      console.warn('[SAS] verify failed (network) — showing page (fail-open)');
      document.documentElement.style.visibility = 'visible';
    });
  }

  function _blocked(reason) {
    document.documentElement.style.visibility = 'visible';
    if (BLOCKED_PATH) {
      window.location.replace(BLOCKED_PATH + '?reason=' + encodeURIComponent(reason));
    } else {
      /* Inline fallback */
      document.body.style.cssText = 'margin:0;background:#070d1a;color:#e2e8f0;' +
        'font-family:sans-serif;display:flex;align-items:center;' +
        'justify-content:center;min-height:100vh;text-align:center';
      document.body.innerHTML =
        '<div style="max-width:360px;padding:20px">' +
        '<div style="font-size:40px;margin-bottom:12px">🔒</div>' +
        '<h2 style="margin-bottom:8px;color:#ff1744">Access Denied</h2>' +
        '<p style="color:#94a3b8;margin-bottom:24px;font-size:14px">Your session is invalid or has expired.</p>' +
        '<a href="' + GATEWAY_URL + '?return=' + encodeURIComponent(pageUrl) + '" ' +
        'style="padding:10px 22px;background:#38bdf8;color:#070d1a;border-radius:6px;' +
        'text-decoration:none;font-weight:700;font-size:14px">Request Access →</a></div>';
    }
  }

  /* ── Session countdown badge ── */
  function _badge(session) {
    if (!session || !session.expiry) return;

    var wrap = document.createElement('div');
    wrap.id  = 'sas-badge';
    wrap.setAttribute('style', [
      'position:fixed', 'bottom:16px', 'right:16px', 'z-index:2147483647',
      'display:inline-flex', 'align-items:center', 'gap:6px',
      'background:rgba(7,13,26,.94)', 'border:1px solid #1e3048',
      'border-radius:6px', 'padding:6px 12px',
      'font-family:monospace', 'font-size:11px', 'letter-spacing:1px',
      'user-select:none', 'pointer-events:none',
      'box-shadow:0 4px 16px rgba(0,0,0,.4)', 'transition:color .3s,border-color .3s',
    ].join(';'));

    var dot  = document.createElement('span');
    var txt  = document.createElement('span');
    wrap.appendChild(dot); wrap.appendChild(txt);

    function mount() {
      if (document.body) { document.body.appendChild(wrap); tick(); }
      else setTimeout(mount, 50);
    }

    function tick() {
      var left = Math.max(0, session.expiry - Math.floor(Date.now() / 1000));
      var m = String(Math.floor(left / 60)).padStart(2, '0');
      var s = String(left % 60).padStart(2, '0');
      var w = left < 60;

      txt.textContent        = '⏱ ' + m + ':' + s;
      wrap.style.color       = w ? '#ff1744' : '#38bdf8';
      wrap.style.borderColor = w ? '#5a1a22' : '#1e3048';
      dot.style.cssText      = 'width:6px;height:6px;border-radius:50%;flex-shrink:0;' +
        'background:' + (w ? '#ff1744' : '#00e676') + ';box-shadow:0 0 5px ' + (w ? '#ff1744' : '#00e676');

      if (left === 0) {
        txt.textContent = 'Refreshing…';
        _store(TOKEN_KEY, null);
        setTimeout(function () {
          _store(FLAG_KEY, '1');
          window.location.replace(GATEWAY_URL + '?return=' + encodeURIComponent(pageUrl));
        }, 1200);
        return;
      }
      setTimeout(tick, 1000);
    }

    mount();
  }

  /* ── sessionStorage helpers (safe — catches private browsing errors) ── */
  function _store(key, val) {
    try { if (val == null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, val); }
    catch (_) {}
  }
  function _load(key) {
    try { return sessionStorage.getItem(key); } catch (_) { return null; }
  }

})();
