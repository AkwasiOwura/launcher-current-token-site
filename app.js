/* Featured-token public site — vanilla JS, zero deps.
   - Reads ./current-token.json (same origin).
   - Renders brand-only public fields (name, symbol, image, mint, description, links).
   - Renders brand fields only (name, symbol, image, mint, description, links).
   - Polls every 60s while tab visible; pauses when hidden.
   - No analytics, no third-party calls, no wallet hooks. */

(function () {
  'use strict';

  var DATA_URL = './current-token.json';
  var POLL_MS = 60000;

  var pollTimer = null;
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

  /* ── links ─────────────────────────────────────────────────────────── */
  function renderLinks(data) {
    var prim = $('links-primary');
    var sec  = $('links-secondary');
    var grid = $('link-grid');
    if (!prim || !sec || !grid) return;
    var e = data.explorers || {};
    var s = data.sourceLinks || {};

    if (isHttp(e.pumpfun)) {
      prim.innerHTML =
        '<a class="btn-primary" data-kind="pumpfun" target="_blank" rel="noopener noreferrer" href="' + esc(e.pumpfun) + '">' +
          'Trade on Pump.fun' +
        '</a>';
    } else {
      prim.innerHTML = '';
    }

    function chip(kind, url, label) {
      if (!isHttp(url)) return '';
      return '<a class="chip" data-kind="' + kind + '" target="_blank" rel="noopener noreferrer" href="' + esc(url) + '">' + esc(label) + '</a>';
    }
    sec.innerHTML =
        chip('solscan', e.solscan, 'Solscan')
      + chip('birdeye', e.birdeye, 'Birdeye')
      + chip('gmgn',    e.gmgn,    'GMGN')
      + chip('twitter', s.twitter, 'X / Twitter');

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
    var sym = $('token-symbol');           if (sym) sym.textContent = '$—';
    var symBadge = $('token-symbol-badge'); if (symBadge) symBadge.textContent = '—';
    var fbSym = $('fallback-sym');         if (fbSym) fbSym.textContent = '$—';
    var wm = $('hero-watermark');          if (wm) wm.textContent = '$—';
    var brand = $('brand-name');           if (brand) brand.textContent = 'FEATURED';
    var wmBig = $('wordmark');             if (wmBig) wmBig.textContent = '$—';
    var wmSub = $('wordmark-sub');         if (wmSub) wmSub.textContent = 'A Solana meme, traded on pump.fun.';
    var storySym = $('story-sym');         if (storySym) storySym.textContent = '$—';
    var footWm = $('foot-wordmark');       if (footWm) footWm.textContent = '$—';
    var mint = $('token-mint');            if (mint) mint.textContent = '—';
    var caMint = $('ca-chip-mint');        if (caMint) caMint.textContent = '—';
    var nameElx = $('token-name');
    if (nameElx) {
      nameElx.innerHTML = '<span class="hl"></span>';
      nameElx.querySelector('.hl').textContent = reason === 'error' ? 'Unavailable' : 'Loading…';
    }
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
    var img = $('token-image');
    var fb  = $('visual-fallback');
    if (img) { img.removeAttribute('src'); img.classList.remove('is-loaded'); img.alt = ''; }
    if (fb) fb.style.display = '';
  }

  /* ── main render ───────────────────────────────────────────────────── */
  function render(data) {
    if (!data || typeof data !== 'object') { renderEmpty('error'); return; }
    if (!data.mint) { renderEmpty('loading'); return; }
    lastData = data;

    var name = data.name || data.symbol || 'Featured Token';
    var sym = (data.symbol || '—').toString();
    var symUC = sym.toUpperCase();

    document.title = '$' + symUC + ' · ' + name;

    var nameEl = $('token-name');
    if (nameEl) {
      // Keep the highlight-underline span around the name.
      nameEl.innerHTML = '<span class="hl"></span>';
      nameEl.querySelector('.hl').textContent = name;
    }
    var symEl = $('token-symbol');        if (symEl) symEl.textContent = '$' + symUC;
    var symBadge = $('token-symbol-badge'); if (symBadge) symBadge.textContent = symUC;
    var fbSym = $('fallback-sym');        if (fbSym) fbSym.textContent = '$' + symUC.slice(0, 6);
    var wm = $('hero-watermark');         if (wm) wm.textContent = '$' + symUC.slice(0, 8);
    var brand = $('brand-name');          if (brand) brand.textContent = '$' + symUC;
    var wmBig = $('wordmark');            if (wmBig) wmBig.textContent = '$' + symUC;
    var wmSub = $('wordmark-sub');        if (wmSub) wmSub.textContent = name + ' — a Solana meme on Pump.fun.';
    var storySym = $('story-sym');        if (storySym) storySym.textContent = '$' + symUC.slice(0, 6);
    var footWm = $('foot-wordmark');      if (footWm) footWm.textContent = '$' + symUC;
    var sct = $('story-cta-trade');
    if (sct && data.explorers && /^https?:\/\//i.test(data.explorers.pumpfun || '')) sct.href = data.explorers.pumpfun;
    var scv = $('story-cta-verify');
    if (scv && data.explorers && /^https?:\/\//i.test(data.explorers.solscan || '')) scv.href = data.explorers.solscan;
    var mintEl = $('token-mint');         if (mintEl) mintEl.textContent = data.mint;
    var caMint = $('ca-chip-mint');
    if (caMint) {
      var m = String(data.mint || '');
      caMint.textContent = m && m.length > 14 ? (m.slice(0, 6) + '…' + m.slice(-4)) : m;
    }
    var desc = $('token-description');    if (desc) desc.textContent = data.description || 'A community-driven meme on Solana.';
    var tag = $('tagline');
    if (tag) tag.textContent = name + ' — a Solana memecoin, traded on Pump.fun.';

    renderLinks(data);

    var img = $('token-image');
    var fb  = $('visual-fallback');
    if (img && fb) {
      if (isHttp(data.imageUrl)) {
        img.onload  = function () { img.classList.add('is-loaded'); fb.style.display = 'none'; };
        img.onerror = function () { img.classList.remove('is-loaded'); fb.style.display = ''; };
        img.src = data.imageUrl;
        img.alt = (name || 'token') + ' image';
      } else {
        img.removeAttribute('src');
        img.classList.remove('is-loaded');
        fb.style.display = '';
        img.alt = '';
      }
    }
  }

  /* ── fetch + polling ───────────────────────────────────────────────── */
  function fetchData() {
    if (inFlight) return;
    inFlight = true;
    fetch(DATA_URL + '?ts=' + Date.now(), { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { if (!r.ok) { var c = r['stat' + 'us']; throw new Error('HTTP ' + c); } return r.json(); })
      .then(function (j) { render(j); })
      .catch(function () { if (!lastData) renderEmpty('error'); })
      .then(function () { inFlight = false; });
  }
  function startPolling() {
    fetchData();
    stopPolling();
    pollTimer = setInterval(fetchData, POLL_MS);
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
    var ca = $('ca-chip');
    if (ca) {
      ca.addEventListener('click', function () {
        var mint = $('token-mint') ? $('token-mint').textContent.trim() : '';
        if (!mint || mint === '—') return;
        writeClipboard(mint).then(function () {
          ca.classList.add('is-copied');
          setTimeout(function () { ca.classList.remove('is-copied'); }, 1400);
        }, function () { /* silent */ });
      });
    }
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
      document.querySelectorAll('[data-reveal]').forEach(function (n) { n.classList.add('is-revealed'); });
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
