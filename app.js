/* Launcher rotating "current token" public site — vanilla JS, zero deps.
   - Reads ./current-token.json (same origin).
   - Allowlisted render only.
   - Polls every 60s while tab visible; pauses when hidden.
   - No analytics, no third-party calls, no wallet hooks.
   - Empty/missing fields degrade gracefully. */

(function () {
  'use strict';

  var SNAPSHOT_URL = './current-token.json';
  var POLL_MS = 60000;
  var REL_TICK_MS = 15000;

  var pollTimer = null;
  var relTimer = null;
  var inFlight = false;
  var lastSnapshot = null;

  /* ── utils ─────────────────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function isHttp(u) { return typeof u === 'string' && /^https?:\/\//i.test(u); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function shortSig(s) { return s && s.length > 18 ? s.slice(0, 10) + '…' + s.slice(-6) : (s || ''); }

  function relTime(iso) {
    if (!iso) return '—';
    var t = new Date(iso).getTime();
    var ms = Date.now() - t;
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
  function fmtDevBuy(v) {
    if (typeof v !== 'number' || !isFinite(v) || v <= 0) return '—';
    return v.toFixed(4) + ' SOL';
  }

  /* ── status ────────────────────────────────────────────────────────── */
  function statusKey(s) {
    s = String(s || '').toLowerCase();
    if (s === 'launched' || s === 'live' || s === 'open') return 'live';
    if (s === 'sold')    return 'sold';
    if (s === 'failed')  return 'failed';
    if (s === 'loading') return 'loading';
    if (s === 'error')   return 'error';
    return 'pending';
  }
  function setStatusPill(s) {
    var pill = $('status-pill'), label = $('status-label');
    if (!pill || !label) return;
    pill.classList.remove('is-live', 'is-sold', 'is-failed', 'is-loading');
    var k = statusKey(s);
    if (k === 'live')         { pill.classList.add('is-live');    label.textContent = 'LIVE'; }
    else if (k === 'sold')    { pill.classList.add('is-sold');    label.textContent = 'SOLD'; }
    else if (k === 'failed')  { pill.classList.add('is-failed');  label.textContent = 'FAILED'; }
    else if (k === 'loading') { pill.classList.add('is-loading'); label.textContent = 'LOADING'; }
    else if (k === 'error')   { pill.classList.add('is-failed');  label.textContent = 'OFFLINE'; }
    else                      { label.textContent = String(s || 'PENDING').toUpperCase(); }
  }
  function setStatusTag(s) {
    var tag = $('status-tag'); if (!tag) return;
    tag.classList.remove('is-live', 'is-sold', 'is-failed');
    var k = statusKey(s);
    if (k === 'live')        { tag.classList.add('is-live');   tag.textContent = 'LIVE'; }
    else if (k === 'sold')   { tag.classList.add('is-sold');   tag.textContent = 'SOLD'; }
    else if (k === 'failed') { tag.classList.add('is-failed'); tag.textContent = 'FAILED'; }
    else                     { tag.textContent = String(s || '—').toUpperCase(); }
  }

  /* ── links + signatures ───────────────────────────────────────────── */
  function renderLinks(snap) {
    var prim = $('links-primary'), sec = $('links-secondary');
    if (!prim || !sec) return;
    var e = snap.explorers || {};
    var s = snap.sourceLinks || {};
    // Primary CTA — only Pump.fun trade link, shown big.
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
      + chip('source',  s.website, 'Source')
      + chip('twitter', s.twitter, 'X / Twitter');
  }

  function renderSigs(snap) {
    var host = $('sig-list'); if (!host) return;
    var rows = [];
    function row(kind, kindKey, sig) {
      if (!sig) return;
      var href = 'https://solscan.io/tx/' + encodeURIComponent(sig);
      rows.push(
        '<a class="sig-row" data-kind="' + kindKey + '" target="_blank" rel="noopener noreferrer" href="' + esc(href) + '" title="' + esc(sig) + '">' +
          '<span class="sig-kind">' + esc(kind) + '</span>' +
          '<span class="sig-link">' + esc(shortSig(sig)) + '</span>' +
          '<span class="sig-ext">Solscan ↗</span>' +
        '</a>'
      );
    }
    row('Create',  'create',  snap.createSignature);
    row('Dev buy', 'dev-buy', snap.devBuySignature);
    row('Sell',    'sell',    snap.sellSignature);
    if (!rows.length) {
      host.innerHTML = '<div class="sig-empty">No on-chain signatures recorded for this token yet.</div>';
    } else {
      host.innerHTML = rows.join('');
    }
    var sigs = $('sigs');
    if (sigs) sigs.style.display = (snap && snap.mint) ? '' : 'none';
  }

  /* ── lifecycle ─────────────────────────────────────────────────────── */
  function renderLifecycle(snap) {
    var s = String(snap.status || '').toLowerCase();
    var has = { create: !!snap.createSignature, devbuy: !!snap.devBuySignature, sell: !!snap.sellSignature };
    var failed = s === 'failed';
    function setStep(key, label, klass) {
      var el = document.querySelector('.step[data-step="' + key + '"]');
      var stateEl = $('step-' + key + '-state');
      if (!el) return;
      el.classList.remove('is-done', 'is-current', 'is-failed', 'is-pending');
      if (klass) el.classList.add(klass);
      if (stateEl) stateEl.textContent = label;
    }
    if (failed && !has.create) setStep('create', 'Failed', 'is-failed');
    else if (has.create)       setStep('create', 'Confirmed', 'is-done');
    else                       setStep('create', 'Pending', 'is-pending');
    if (failed && !has.devbuy) setStep('devbuy', 'Failed', 'is-failed');
    else if (has.devbuy)       setStep('devbuy', 'Confirmed', 'is-done');
    else                       setStep('devbuy', 'Pending', 'is-pending');
    if (failed)                setStep('hold', 'Aborted', 'is-failed');
    else if (has.sell)         setStep('hold', 'Complete', 'is-done');
    else if (has.devbuy)       setStep('hold', 'Holding', 'is-current');
    else                       setStep('hold', 'Pending', 'is-pending');
    if (failed)                setStep('exit', 'Failed', 'is-failed');
    else if (has.sell)         setStep('exit', 'Sold', 'is-done');
    else if (has.devbuy)       setStep('exit', 'Pending', 'is-current');
    else                       setStep('exit', '—', 'is-pending');
  }

  /* ── empty / error states ─────────────────────────────────────────── */
  function renderEmpty(reason) {
    setStatusPill(reason || 'loading');
    var name = $('token-name');
    if (name) name.textContent = reason === 'error' ? 'Snapshot unavailable' : 'No token yet';
    var sym = $('token-symbol');           if (sym) sym.textContent = '$—';
    var symBadge = $('token-symbol-badge'); if (symBadge) symBadge.textContent = '—';
    var fbSym = $('fallback-sym');         if (fbSym) fbSym.textContent = '$—';
    var wm = $('hero-watermark');          if (wm) wm.textContent = '$—';
    var mint = $('token-mint');            if (mint) mint.textContent = '—';
    var desc = $('token-description');
    if (desc) {
      desc.textContent = reason === 'error'
        ? 'Could not load the current token snapshot. The page will keep retrying automatically.'
        : 'The Launcher has not produced a token yet. This page will refresh the moment one launches.';
    }
    var p = $('links-primary');   if (p) p.innerHTML = '';
    var sc = $('links-secondary'); if (sc) sc.innerHTML = '';
    var sigs = $('sigs');         if (sigs) sigs.style.display = 'none';
    var sigList = $('sig-list');  if (sigList) sigList.innerHTML = '';
    ['stat-status', 'stat-launched', 'stat-devbuy', 'stat-updated'].forEach(function (id) {
      var n = $(id); if (n) n.textContent = '—';
    });
    var cardTime = $('card-foot-time'); if (cardTime) cardTime.textContent = '—';
    var metaTime = $('meta-time');      if (metaTime) metaTime.textContent = '—';
    var tag = $('status-tag');
    if (tag) { tag.classList.remove('is-live','is-sold','is-failed'); tag.textContent = '—'; }
    var img = $('token-image');
    var fb  = $('visual-fallback');
    if (img) { img.removeAttribute('src'); img.classList.remove('is-loaded'); img.alt = ''; }
    if (fb) fb.style.display = '';
    ['create', 'devbuy', 'hold', 'exit'].forEach(function (k) {
      var el = document.querySelector('.step[data-step="' + k + '"]');
      var st = $('step-' + k + '-state');
      if (el) el.classList.remove('is-done', 'is-current', 'is-failed', 'is-pending');
      if (st) st.textContent = '—';
    });
    var fm = $('foot-meta');
    if (fm) fm.textContent = reason === 'error' ? 'snapshot offline' : 'awaiting first launch';
  }

  /* ── main render ───────────────────────────────────────────────────── */
  function render(snap) {
    if (!snap || typeof snap !== 'object') { renderEmpty('error'); return; }
    if (!snap.mint) { renderEmpty('loading'); return; }
    lastSnapshot = snap;

    setStatusPill(snap.status);
    setStatusTag(snap.status);

    var name = snap.name || snap.symbol || 'Unnamed';
    var sym = (snap.symbol || '—').toString();
    var symUC = sym.toUpperCase();

    document.title = '$' + symUC + ' · ' + name + ' — Launcher';

    var nameEl = $('token-name');         if (nameEl) nameEl.textContent = name;
    var symEl = $('token-symbol');        if (symEl) symEl.textContent = '$' + symUC;
    var symBadge = $('token-symbol-badge'); if (symBadge) symBadge.textContent = symUC;
    var fbSym = $('fallback-sym');        if (fbSym) fbSym.textContent = '$' + symUC.slice(0, 6);
    var wm = $('hero-watermark');         if (wm) wm.textContent = '$' + symUC.slice(0, 8);
    var mintEl = $('token-mint');         if (mintEl) mintEl.textContent = snap.mint;
    var desc = $('token-description');    if (desc) desc.textContent = snap.description || '—';

    var statStatus = $('stat-status');    if (statStatus) statStatus.textContent = (snap.status || '—').toString().toUpperCase();
    var statLaunched = $('stat-launched');
    if (statLaunched) { statLaunched.textContent = relTime(snap.launchedAt); statLaunched.title = absTime(snap.launchedAt); }
    var statDevbuy = $('stat-devbuy');    if (statDevbuy) statDevbuy.textContent = fmtDevBuy(snap.devBuySol);
    var statUpdated = $('stat-updated');
    if (statUpdated) { statUpdated.textContent = relTime(snap.updatedAt); statUpdated.title = absTime(snap.updatedAt); }
    var cardTime = $('card-foot-time'); if (cardTime) cardTime.textContent = relTime(snap.launchedAt || snap.updatedAt);
    var metaTime = $('meta-time');      if (metaTime) metaTime.textContent = 'Launched ' + relTime(snap.launchedAt);

    if (snap.disclaimer) { var dis = $('disclaimer'); if (dis) dis.textContent = snap.disclaimer; }
    var fm = $('foot-meta'); if (fm) fm.textContent = 'snapshot v' + (snap.schemaVersion || 1) + ' · ' + relTime(snap.updatedAt);

    renderLinks(snap);
    renderSigs(snap);
    renderLifecycle(snap);

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

  /* ── tick relative times only ──────────────────────────────────────── */
  function tickRelTimes() {
    if (!lastSnapshot) return;
    var s = lastSnapshot;
    var sl = $('stat-launched'); if (sl) sl.textContent = relTime(s.launchedAt);
    var su = $('stat-updated');  if (su) su.textContent = relTime(s.updatedAt);
    var ct = $('card-foot-time'); if (ct) ct.textContent = relTime(s.launchedAt || s.updatedAt);
    var mt = $('meta-time');      if (mt) mt.textContent = 'Launched ' + relTime(s.launchedAt);
    var fm = $('foot-meta');      if (fm) fm.textContent = 'snapshot v' + (s.schemaVersion || 1) + ' · ' + relTime(s.updatedAt);
  }

  /* ── fetch + polling ───────────────────────────────────────────────── */
  function fetchSnapshot() {
    if (inFlight) return;
    inFlight = true;
    fetch(SNAPSHOT_URL + '?ts=' + Date.now(), { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { render(j); })
      .catch(function () { if (!lastSnapshot) renderEmpty('error'); })
      .then(function () { inFlight = false; });
  }
  function startPolling() {
    fetchSnapshot();
    stopPolling();
    pollTimer = setInterval(fetchSnapshot, POLL_MS);
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

  /* ── boot ──────────────────────────────────────────────────────────── */
  function boot() {
    setStatusPill('loading');
    bindCopy();
    startPolling();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
