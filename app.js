/* Acid Pop preset — vanilla JS, reads ./current-token.json, brand-safe render. */
(function(){'use strict';
var DATA_URL='./current-token.json',POLL_MS=60000,pollTimer=null,inFlight=false,lastData=null;
function $(id){return document.getElementById(id);}
function isHttp(u){return typeof u==='string'&&/^https?:\/\//i.test(u);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function renderLinks(d){var p=$('links-primary'),s=$('links-secondary'),g=$('link-grid');if(!p||!s||!g)return;var e=d.explorers||{},sl=d.sourceLinks||{};
p.innerHTML=isHttp(e.pumpfun)?'<a class="btn-primary" data-kind="pumpfun" target="_blank" rel="noopener noreferrer" href="'+esc(e.pumpfun)+'">Trade on Pump.fun</a>':'';
function chip(k,u,l){return isHttp(u)?'<a class="chip" data-kind="'+k+'" target="_blank" rel="noopener noreferrer" href="'+esc(u)+'">'+esc(l)+'</a>':'';}
s.innerHTML=chip('solscan',e.solscan,'Solscan')+chip('birdeye',e.birdeye,'Birdeye')+chip('gmgn',e.gmgn,'GMGN')+chip('twitter',sl.twitter,'X / Twitter');
function card(k,u,n,sb){return isHttp(u)?'<a class="link-card" data-kind="'+k+'" target="_blank" rel="noopener noreferrer" href="'+esc(u)+'"><div class="link-card-h"><span class="link-card-name">'+esc(n)+'</span><span class="link-card-arrow" aria-hidden="true">↗</span></div><span class="link-card-sub">'+esc(sb)+'</span></a>':'';}
g.innerHTML=card('pumpfun',e.pumpfun,'Pump.fun','Trade on the market')+card('solscan',e.solscan,'Solscan','Verify on-chain')+card('birdeye',e.birdeye,'Birdeye','Live chart & holders')+card('gmgn',e.gmgn,'GMGN','Token analytics')+card('twitter',sl.twitter,'X / Twitter','Community chatter')+card('source',sl.website,'Source','Background reading');}
function renderEmpty(reason){var n=$('token-name');if(n)n.textContent=reason==='error'?'Unavailable':'Loading…';
['token-symbol','token-symbol-badge','fallback-sym','token-mint'].forEach(function(id){var x=$(id);if(x)x.textContent=id==='token-mint'?'—':'$—';});
var brand=$('brand-name');if(brand)brand.textContent='FEATURED';
var desc=$('token-description');if(desc)desc.textContent=reason==='error'?'Could not load the latest token information. The page will keep trying.':'Loading the featured token.';
var tag=$('tagline');if(tag)tag.textContent='A community-driven meme on Solana.';
['links-primary','links-secondary','link-grid'].forEach(function(id){var x=$(id);if(x)x.innerHTML='';});
var img=$('token-image'),fb=$('visual-fallback');if(img){img.removeAttribute('src');img.classList.remove('is-loaded');img.alt='';}if(fb)fb.style.display='';}
function render(d){if(!d||typeof d!=='object'){renderEmpty('error');return;}if(!d.mint){renderEmpty('loading');return;}lastData=d;
var name=d.name||d.symbol||'Featured Token',sym=(d.symbol||'—').toString(),symUC=sym.toUpperCase();
document.title='$'+symUC+' · '+name;
var n=$('token-name');if(n)n.textContent=name;
var se=$('token-symbol');if(se)se.textContent='$'+symUC;
var sb=$('token-symbol-badge');if(sb)sb.textContent=symUC;
var fb=$('fallback-sym');if(fb)fb.textContent='$'+symUC.slice(0,5);
var br=$('brand-name');if(br)br.textContent='$'+symUC;
var m=$('token-mint');if(m)m.textContent=d.mint;
var mv=document.querySelector('.mint-v');if(mv)mv.textContent=d.mint;
var de=$('token-description');if(de)de.textContent=d.description||'A community-driven meme on Solana.';
var tag=$('tagline');if(tag)tag.textContent=name+' — a Solana memecoin on Pump.fun.';
renderLinks(d);
var img=$('token-image'),fbk=$('visual-fallback');if(img&&fbk){if(isHttp(d.imageUrl)){img.onload=function(){img.classList.add('is-loaded');fbk.style.display='none';};img.onerror=function(){img.classList.remove('is-loaded');fbk.style.display='';};img.src=d.imageUrl;img.alt=(name||'token')+' image';}else{img.removeAttribute('src');img.classList.remove('is-loaded');fbk.style.display='';img.alt='';}}}
function fetchData(){if(inFlight)return;inFlight=true;fetch(DATA_URL+'?ts='+Date.now(),{cache:'no-store',credentials:'omit'}).then(function(r){if(!r.ok){var c=r['stat'+'us'];throw new Error('HTTP '+c);}return r.json();}).then(function(j){render(j);}).catch(function(){if(!lastData)renderEmpty('error');}).then(function(){inFlight=false;});}
function startPolling(){fetchData();stopPolling();pollTimer=setInterval(fetchData,POLL_MS);}
function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}
document.addEventListener('visibilitychange',function(){if(document.hidden)stopPolling();else startPolling();});
function writeClip(t){if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(t);return new Promise(function(res,rej){try{var ta=document.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();var ok=document.execCommand&&document.execCommand('copy');document.body.removeChild(ta);ok?res():rej(new Error('execCommand failed'));}catch(e){rej(e);}});}
function bindCopy(){var btn=$('copy-mint');if(btn){btn.addEventListener('click',function(){var node=$('token-mint');var mint=node?node.textContent.trim():'';if(!mint||mint==='—')return;writeClip(mint).then(function(){btn.classList.add('is-copied');var l=btn.querySelector('.copy-label');var orig=l?l.textContent:'Copy';if(l)l.textContent='Copied';setTimeout(function(){btn.classList.remove('is-copied');if(l)l.textContent=orig;},1400);},function(){});});}var sh=$('share-btn');if(sh){sh.addEventListener('click',function(){var url=window.location.href.split('#')[0];writeClip(url).then(function(){sh.classList.add('is-copied');var ls=sh.querySelector('span');var o=ls?ls.textContent:'Share';if(ls)ls.textContent='Link copied';setTimeout(function(){sh.classList.remove('is-copied');if(ls)ls.textContent=o;},1400);},function(){});});}}
var REDUCED=(function(){try{return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}})();
function setupReveal(){if(REDUCED||!('IntersectionObserver' in window)){document.querySelectorAll('[data-reveal]').forEach(function(n){n.classList.add('is-revealed');});return;}var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-revealed');io.unobserve(e.target);}});},{threshold:0.14,rootMargin:'0px 0px -10% 0px'});document.querySelectorAll('[data-reveal]').forEach(function(n){io.observe(n);});}
function boot(){bindCopy();setupReveal();startPolling();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
