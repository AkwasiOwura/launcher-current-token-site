/* Featured-token public site — vanilla JS, zero deps.
   - Reads ./current-token.json (same origin).
   - Renders public, token-focused fields only.
   - Polls every 60s while tab visible; pauses when hidden.
   - No analytics, no third-party calls, no wallet hooks. */

(function () {
  'use strict';

  var DATA_URL = './current-token.json';
  var POLL_MS = 60000;
  var REL_TICK_MS = 15000;

  var pollTimer = null;
  var relTimer = null;
  var inFlight = false;
  var lastData = null;

  /* ── utils ─────────────────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function isHttp(u) { return typeof u === 'string' && /^https?:\/\//i.test(u); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function relTime(iso) {
    if (!iso) return '—';
    var ms = Date.now() - new Date(iso).getTime();
    if (!isFinite(ms) || ms < 0) return '—';
    if (ms < 5000)     return 'just now';
    if (ms < 60000)    return Math.round(ms / 1000) + 's ago';
    if (ms < 3600000)  return Math.round(ms / 60000) + 'm ago';
    if (ms < 86400000) return Math.round(ms / 3600000) + 'h ago';
    return Math.round(ms / 86400000) + 'd ago';
  }
  function absTime(iso) {
    if (!iso) return '';
    try { return new Date(iso).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'; } catch (e) { return ''; }
  }

  /* ── status mapping (public-facing only) ───────────────────────────── */
  function statusKey(s) {
    s = String(s || '').toLowerCase();
    if (s === 'launched' || s === 'live' || s === 'open') return 'live';
    if (s === 'sold')    return 'sold';
    if (s === 'failed')  return 'failed';
    if (s === 'loading') return 'loading';
    if (s === 'error')   return 'error';
    return 'pending';
  }
  function publicStatusLabel(s) {
    var k = statusKey(s);
    if (k === 'live')    return 'LIVE';
    if (k === 'sold')    return 'CLOSED';
    if (k === 'failed')  return 'INACTIVE';
    if (k === 'loading') return 'LOADING';
    if (k === 'error')   return 'OFFLINE';
    return 'PENDING';
  }
  function setStatusPill(s) {
    var pill = $('status-pill'), label = $('status-label');
    if (!pill || !label) return;
    pill.classList.remove('is-live', 'is-sold', 'is-failed', 'is-loading');
    var k = statusKey(s);
    if (k === 'live')         { pill.classList.add('is-live');    label.textContent = 'LIVE'; }
    else if (k === 'sold')    { pill.classList.add('is-sold');    label.textContent = 'CLOSED'; }
    else if (k === 'failed')  { pill.classList.add('is-failed');  label.textContent = 'INACTIVE'; }
    else if (k === 'loading') { pill.classList.add('is-loading'); label.textContent = 'LOADING'; }
    else if (k === 'error')   { pill.classList.add('is-failed');  label.textContent = 'OFFLINE'; }
    else                      { label.textContent = String(s || 'PENDING').toUpperCase(); }
  }
  function setStatusTag(s) {
    var tag = $('status-tag'); if (!tag) return;
    tag.classList.remove('is-live', 'is-sold', 'is-failed');
    var k = statusKey(s);
    if (k === 'live')        { tag.classList.add('is-live');   tag.textContent = 'LIVE'; }
    else if (k === 'sold')   { tag.classList.add('is-sold');   tag.textContent = 'CLOSED'; }
    else if (k === 'failed') { tag.classList.add('is-failed'); tag.textContent = 'INACTIVE'; }
    else                     { tag.textContent = String(s || '—').toUpperCase(); }
  }

  /* ── links ─────────────────────────────────────────────────────────── */
  function renderLinks(snap) {
    var prim = $('links-primary');
    var sec  = $('links-secondary');
    var grid = $('link-grid');
    if (!prim || !sec || !grid) return;
    var e = snap.explorers || {};
    var s = snap.sourceLinks || {};

    // Primary CTA — only Pump.fun, as the big button.
    if (isHttp(e.pumpfun)) {
      prim.innerHTML =
        '<a class="btn-primary" data-kind="pumpfun" target="_blank" rel="noopener noreferrer" href="' + esc(e.pumpfun) + '">' +
          'Trade on Pump.fun' +
        '</a>';
    } else {
      prim.innerHTML = '';
    }

    // Secondary chips next to the hero.
    function chip(kind, url, label) {
      if (!isHttp(url)) return '';
      return '<a class="chip" data-kind="' + kind + '" target="_blank" rel="noopener noreferrer" href="' + esc(url) + '">' + esc(label) + '</a>';
    }
    sec.innerHTML =
        chip('solscan', e.solscan, 'Solscan')
      + chip('birdeye', e.birdeye, 'Birdeye')
      + chip('gmgn',    e.gmgn,    'GMGN')
      + chip('twitter', s.twitter, 'X / Twitter');

    // Community grid cards (richer presentation).
    function card(kind, url, name, sub) {
      if (!isHttp(url)) return '';
      return (
        '<a class="link-card" data-kind="' + kind + '" target="_blank" rel="noopener noreferrer" href="' + esc(url) + '">' +
          '<div class="link-card-h">' +
            '<span class="link-card-name">' + esc(name) + '</span>' +
            '<span class="link-card-arrow" aria-hidden="true">↗</span>' +
          '</div>' +
          '<span class="link-card-sub">' + esc(sub) + '</span>' +
        '</a>'
      );
    }
    grid.innerHTML =
        card('pumpfun', e.pumpfun, 'Pump.fun',  'Trade on the market')
      + card('solscan', e.solscan, 'Solscan',   'Verify on-chain')
      + card('birdeye', e.birdeye, 'Birdeye',   'Live chart & holders')
      + card('gmgn',    e.gmgn,    'GMGN',      'Token analytics')
      + card('twitter', s.twitter, 'X / Twitter','Community chatter')
      + card('source',  s.website, 'Source',    'Background reading');
  }

  /* ── empty / error states ─────────────────────────────────────────── */
  function renderEmpty(reason) {
    setStatusPill(reason || 'loading');
    var name = $('token-name');
    if (name) name.textContent = reason === 'error' ? 'Unavailable' : 'Loading…';
    var sym = $('token-symbol');           if (sym) sym.textContent = '$—';
    var symBadge = $('token-symbol-badge'); if (symBadge) symBadge.textContent = '—';
    var fbSym = $('fallback-sym');         if (fbSym) fbSym.textContent = '$—';
    var wm = $('hero-watermark');          if (wm) wm.textContent = '$—';
    var brand = $('brand-name');           if (brand) brand.textContent = 'FEATURED';
    var mint = $('token-mint');            if (mint) mint.textContent = '—';
    var desc = $('token-description');
    if (desc) {
      desc.textContent = reason === 'error'
        ? 'Could not load the latest token information. The page will keep trying.'
        : 'Loading the featured token.';
    }
    var tag = $('tagline');
    if (tag) tag.textContent = 'A community-driven meme on Solana.';
    var p = $('links-primary');   if (p) p.innerHTML = '';
    var sc = $('links-secondary'); if (sc) sc.innerHTML = '';
    var grid = $('link-grid');     if (grid) grid.innerHTML = '';
    var statStatus = $('stat-status');     if (statStatus) statStatus.textContent = '—';
    var statLaunched = $('stat-launched'); if (statLaunched) statLaunched.textContent = '—';
    var metaTime = $('meta-time');         if (metaTime) metaTime.textContent = '—';
    var stag = $('status-tag');
    if (stag) { stag.classList.remove('is-live','is-sold','is-failed'); stag.textContent = '—'; }
    var img = $('token-image');
    var fb  = $('visual-fallback');
    if (img) { img.removeAttribute('src'); img.classList.remove('is-loaded'); img.alt = ''; }
    if (fb) fb.style.display = '';
  }

  /* ── main render ───────────────────────────────────────────────────── */
  function render(snap) {
    if (!snap || typeof snap !== 'object') { renderEmpty('error'); return; }
    if (!snap.mint) { renderEmpty('loading'); return; }
    lastData = snap;

    setStatusPill(snap.status);
    setStatusTag(snap.status);

    var name = snap.name || snap.symbol || 'Featured Token';
    var sym = (snap.symbol || '—').toString();
    var symUC = sym.toUpperCase();

    document.title = '$' + symUC + ' · ' + name;

    var nameEl = $('token-name');         if (nameEl) nameEl.textContent = name;
    var symEl = $('token-symbol');        if (symEl) symEl.textContent = '$' + symUC;
    var symBadge = $('token-symbol-badge'); if (symBadge) symBadge.textContent = symUC;
    var fbSym = $('fallback-sym');        if (fbSym) fbSym.textContent = '$' + symUC.slice(0, 6);
    var wm = $('hero-watermark');         if (wm) wm.textContent = '$' + symUC.slice(0, 8);
    var brand = $('brand-name');          if (brand) brand.textContent = '$' + symUC;
    var mintEl = $('token-mint');         if (mintEl) mintEl.textContent = snap.mint;
    var desc = $('token-description');    if (desc) desc.textContent = snap.description || 'A community-driven meme on Solana.';
    var tag = $('tagline');
    if (tag) {
      // Short, public tagline derived from the token's own name/symbol.
      tag.textContent = name + ' — live on Solana, traded on Pump.fun.';
    }

    var statStatus = $('stat-status');    if (statStatus) statStatus.textContent = publicStatusLabel(snap.status);
    var statLaunched = $('stat-launched');
    if (statLaunched) { statLaunched.textContent = relTime(snap.launchedAt); statLaunched.title = absTime(snap.launchedAt); }
    var metaTime = $('meta-time');        if (metaTime) metaTime.textContent = 'Launched ' + relTime(snap.launchedAt);

    renderLinks(snap);

    var img = $('token-image');
    var fb  = $('visual-fallback');
    if (img && fb) {
      if (isHttp(snap.imageUrl)) {
        img.onload  = function () { img.classList.add('is-loaded'); fb.style.display = 'none'; };
        img.onerror = function () { img.classList.remove('is-loaded'); fb.style.display = ''; };
        img.src = snap.imageUrl;
        img.alt = (name || 'token') + ' image';
      } else {
        img.removeAttribute('src');
        img.classList.remove('is-loaded');
        fb.style.display = '';
        img.alt = '';
      }
    }
  }

  function tickRelTimes() {
    if (!lastData) return;
    var s = lastData;
    var sl = $('stat-launched'); if (sl) sl.textContent = relTime(s.launchedAt);
    var mt = $('meta-time');     if (mt) mt.textContent = 'Launched ' + relTime(s.launchedAt);
  }

  /* ── fetch + polling ───────────────────────────────────────────────── */
  function fetchData() {
    if (inFlight) return;
    inFlight = true;
    fetch(DATA_URL + '?ts=' + Date.now(), { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { render(j); })
      .catch(function () { if (!lastData) renderEmpty('error'); })
      .then(function () { inFlight = false; });
  }
  function startPolling() {
    fetchData();
    stopPolling();
    pollTimer = setInterval(fetchData, POLL_MS);
    if (!relTimer) relTimer = setInterval(tickRelTimes, REL_TICK_MS);
  }
  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopPolling(); else startPolling();
  });

  /* ── copy helpers ──────────────────────────────────────────────────── */
  function flashCopy(btn, ok) {
    var labelEl = btn.querySelector('.copy-label');
    var origLabel = labelEl ? labelEl.textContent : 'Copy';
    btn.classList.toggle('is-copied', ok);
    if (labelEl) labelEl.textContent = ok ? 'Copied' : 'Failed';
    setTimeout(function () {
      btn.classList.remove('is-copied');
      if (labelEl) labelEl.textContent = origLabel;
    }, 1400);
  }
  function writeClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand && document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('execCommand failed'));
      } catch (e) { reject(e); }
    });
  }
  function bindCopy() {
    var btn = $('copy-mint');
    if (btn) {
      btn.addEventListener('click', function () {
        var node = $('token-mint');
        var mint = node ? node.textContent.trim() : '';
        if (!mint || mint === '—') return;
        writeClipboard(mint).then(function () { flashCopy(btn, true); }, function () { flashCopy(btn, false); });
      });
    }
    var mintCode = $('token-mint');
    if (mintCode) mintCode.addEventListener('click', function () { if (btn) btn.click(); });

    var share = $('share-btn');
    if (share) {
      share.addEventListener('click', function () {
        var url = window.location.href.split('#')[0];
        writeClipboard(url).then(function () {
          share.classList.add('is-copied');
          var labelSpan = share.querySelector('span');
          var orig = labelSpan ? labelSpan.textContent : 'Share';
          if (labelSpan) labelSpan.textContent = 'Link copied';
          setTimeout(function () {
            share.classList.remove('is-copied');
            if (labelSpan) labelSpan.textContent = orig;
          }, 1400);
        }, function () { /* silent */ });
      });
    }
  }

  /* ── motion: reveal-on-scroll, scroll-progress, spotlight, card tilt ── */
  var REDUCED = (function () {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  })();

  function setupReveal() {
    if (REDUCED) {
      // Skip animations; mark everything visible immediately.
      var all = document.querySelectorAll('[data-reveal]');
      for (var i = 0; i < all.length; i++) all[i].classList.add('is-revealed');
      return;
    }
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-reveal]').forEach(function (n) { n.classList.add('is-revealed'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-revealed');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('[data-reveal]').forEach(function (n) { io.observe(n); });
  }

  function setupScrollProgress() {
    var bar = document.getElementById('scroll-progress-bar');
    if (!bar) return;
    function tick() {
      var h = document.documentElement;
      var scrolled = h.scrollTop || document.body.scrollTop;
      var max = (h.scrollHeight - h.clientHeight) || 1;
      var pct = Math.max(0, Math.min(100, (scrolled / max) * 100));
      bar.style.width = pct.toFixed(2) + '%';
    }
    tick();
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
  }

  function setupSpotlight() {
    if (REDUCED) return;
    var spot = document.getElementById('bg-spotlight');
    if (!spot) return;
    var raf = null;
    var pendingX = null, pendingY = null;
    function apply() {
      raf = null;
      if (pendingX == null) return;
      spot.style.setProperty('--mx', pendingX + '%');
      spot.style.setProperty('--my', pendingY + '%');
    }
    window.addEventListener('pointermove', function (ev) {
      var w = window.innerWidth || 1;
      var h = window.innerHeight || 1;
      pendingX = Math.max(0, Math.min(100, (ev.clientX / w) * 100));
      pendingY = Math.max(0, Math.min(100, (ev.clientY / h) * 100));
      if (raf == null) raf = requestAnimationFrame(apply);
    }, { passive: true });
  }

  function setupCardTilt() {
    if (REDUCED) return;
    var card = document.querySelector('.token-visual .visual-frame');
    if (!card) return;
    var host = document.querySelector('.token-visual');
    if (!host) return;
    var raf = null;
    var targetRx = 0, targetRy = 0;
    function apply() {
      raf = null;
      card.style.setProperty('--rx', targetRx.toFixed(2) + 'deg');
      card.style.setProperty('--ry', targetRy.toFixed(2) + 'deg');
    }
    host.addEventListener('pointermove', function (ev) {
      var r = host.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var dx = (ev.clientX - cx) / (r.width / 2);
      var dy = (ev.clientY - cy) / (r.height / 2);
      // Limit tilt to ±6deg for a subtle effect.
      targetRx = Math.max(-6, Math.min(6, dx * 6));
      targetRy = Math.max(-6, Math.min(6, -dy * 6));
      if (raf == null) raf = requestAnimationFrame(apply);
    });
    host.addEventListener('pointerleave', function () {
      targetRx = 0; targetRy = 0;
      if (raf == null) raf = requestAnimationFrame(apply);
    });
  }

  /* ── boot ──────────────────────────────────────────────────────────── */
  function boot() {
    setStatusPill('loading');
    bindCopy();
    setupReveal();
    setupScrollProgress();
    setupSpotlight();
    setupCardTilt();
    startPolling();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
