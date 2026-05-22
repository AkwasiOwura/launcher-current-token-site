/* Featured token — Noir Grid preset.
   Vanilla JS, zero deps. Reads ./current-token.json (same origin).
   Renders only brand-safe fields. No analytics, no third-party calls. */

(function () {
  'use strict';

  var DATA_URL = './current-token.json';
  var POLL_MS = 60000;

  var pollTimer = null;
  var inFlight = false;
  var lastData = null;

  function $(id) { return document.getElementById(id); }
  function isHttp(u) { return typeof u === 'string' && /^https?:\/\//i.test(u); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

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
        card('pumpfun', e.pumpfun, 'Pump.fun',   'Trade on the market')
      + card('solscan', e.solscan, 'Solscan',    'Verify on-chain')
      + card('birdeye', e.birdeye, 'Birdeye',    'Live chart & holders')
      + card('gmgn',    e.gmgn,    'GMGN',       'Token analytics')
      + card('twitter', s.twitter, 'X / Twitter','Community chatter')
      + card('source',  s.website, 'Source',     'Background reading');
  }

  function renderEmpty(reason) {
    var name = $('token-name');
    if (name) name.textContent = reason === 'error' ? 'Unavailable' : 'Loading…';
    var sym = $('token-symbol');           if (sym) sym.textContent = '$—';
    var symBadge = $('token-symbol-badge'); if (symBadge) symBadge.textContent = '—';
    var fbSym = $('fallback-sym');         if (fbSym) fbSym.textContent = '$—';
    var brand = $('brand-name');           if (brand) brand.textContent = 'FEATURED';
    var mint = $('token-mint');            if (mint) mint.textContent = '—';
    var mintVal = document.querySelector('.mint-value');
    if (mintVal) mintVal.textContent = '—';
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

  function render(data) {
    if (!data || typeof data !== 'object') { renderEmpty('error'); return; }
    if (!data.mint) { renderEmpty('loading'); return; }
    lastData = data;

    var name = data.name || data.symbol || 'Featured Token';
    var sym = (data.symbol || '—').toString();
    var symUC = sym.toUpperCase();

    document.title = '$' + symUC + ' · ' + name;

    var nameEl = $('token-name');         if (nameEl) nameEl.textContent = name;
    var symEl = $('token-symbol');        if (symEl) symEl.textContent = '$' + symUC;
    var symBadge = $('token-symbol-badge'); if (symBadge) symBadge.textContent = symUC;
    var fbSym = $('fallback-sym');        if (fbSym) fbSym.textContent = '$' + symUC.slice(0, 4);
    var brand = $('brand-name');          if (brand) brand.textContent = '$' + symUC;
    var mintEl = $('token-mint');         if (mintEl) mintEl.textContent = data.mint;
    var mintVal = document.querySelector('.mint-value');
    if (mintVal) mintVal.textContent = data.mint;
    var desc = $('token-description');    if (desc) desc.textContent = data.description || 'A community-driven meme on Solana.';
    var tag = $('tagline');
    if (tag) tag.textContent = '“' + name + '” — a Solana meme on Pump.fun.';

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
  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopPolling(); else startPolling();
  });

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
        writeClipboard(mint).then(function () {
          btn.classList.add('is-copied');
          var label = btn.querySelector('.copy-label');
          var orig = label ? label.textContent : 'Copy';
          if (label) label.textContent = 'Copied';
          setTimeout(function () { btn.classList.remove('is-copied'); if (label) label.textContent = orig; }, 1400);
        }, function () { /* silent */ });
      });
    }
    var share = $('share-btn');
    if (share) {
      share.addEventListener('click', function () {
        var url = window.location.href.split('#')[0];
        writeClipboard(url).then(function () {
          share.classList.add('is-copied');
          var ls = share.querySelector('span');
          var orig = ls ? ls.textContent : 'Share';
          if (ls) ls.textContent = 'Link copied';
          setTimeout(function () { share.classList.remove('is-copied'); if (ls) ls.textContent = orig; }, 1400);
        }, function () { /* silent */ });
      });
    }
  }

  var REDUCED = (function () {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  })();

  function setupReveal() {
    if (REDUCED || !('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-reveal]').forEach(function (n) { n.classList.add('is-revealed'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-revealed'); io.unobserve(e.target); } });
    }, { threshold: 0.14, rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('[data-reveal]').forEach(function (n) { io.observe(n); });
  }
  function setupScrollProgress() {
    var bar = $('scroll-progress-bar');
    if (!bar) return;
    function tick() {
      var h = document.documentElement;
      var scrolled = h.scrollTop || document.body.scrollTop;
      var max = (h.scrollHeight - h.clientHeight) || 1;
      bar.style.width = Math.max(0, Math.min(100, (scrolled / max) * 100)).toFixed(2) + '%';
    }
    tick();
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
  }

  function boot() {
    bindCopy();
    setupReveal();
    setupScrollProgress();
    startPolling();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
