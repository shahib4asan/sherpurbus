/* ============================================================
app.js — SherpurBus Application Logic
Depends on: data.js (busData, divisionRoutes,
bakshiganjRoutes, jhenaigatiRoutes, locations)
============================================================ */

/* ── State ── */
let lang             = ‘bn’;
let activeTimeFilter = ‘all’;
let activeRoute      = ‘dhaka’;
let fromValue        = ‘’;
let toValue          = ‘’;

/* ── Utilities ── */
function normBn(s) {
return s.replace(/[০-৯]/g, d => ‘০১২৩৪৫৬৭৮৯’.indexOf(d).toString());
}
function norm(s) { return normBn(s.toLowerCase().trim()); }
function hl(text, q) {
if (!q) return text;
try {
const e = q.replace(/[.*+?^${}()|[]\]/g, ‘\$&’);
return text.replace(new RegExp(`(${e})`, ‘gi’), ‘<mark>$1</mark>’);
} catch { return text; }
}
function phoneDigits(p) { return p.replace(/[^0-9]/g, ‘’); }

/* ── Phone call SVG ── */
const callSvg = `<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6.13 6.13l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
const pinSvg  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`;
const timeSvg = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;

/* ── Suggestion Engine ── */
function getSuggestions(query) {
const q = norm(query);
if (!q) return [];
return locations.filter(loc => {
const hay = [loc.bn, loc.en, …loc.aliases].map(norm).join(’ ’);
return hay.includes(q) || loc.aliases.some(a => norm(a).startsWith(q));
}).slice(0, 6);
}

function renderSuggestions(listId, items, field) {
const el = document.getElementById(listId);
if (!items.length) { el.classList.remove(‘open’); el.innerHTML = ‘’; return; }
el.innerHTML = items.map(loc => {
const label = lang === ‘bn’ ? loc.bn : loc.en;
return `<div class="sug-item" onmousedown="event.preventDefault()" onclick="selectLocation('${field}','${loc.bn}','${loc.en}')">${pinSvg}<span>${label}</span></div>`;
}).join(’’);
el.classList.add(‘open’);
}

/* ── Input Handlers ── */
function onFTInput(field, val) {
if (field === ‘from’) fromValue = val; else toValue = val;
renderSuggestions(field === ‘from’ ? ‘fromSug’ : ‘toSug’, getSuggestions(val), field);
}
function onFTFocus(field) {
const inp = document.getElementById(field === ‘from’ ? ‘fromInput’ : ‘toInput’);
onFTInput(field, inp.value);
}
function onFTBlur(field) {
setTimeout(() => document.getElementById(field === ‘from’ ? ‘fromSug’ : ‘toSug’).classList.remove(‘open’), 150);
}
function selectLocation(field, bn, en) {
const label = lang === ‘bn’ ? bn : en;
const inputId = field === ‘from’ ? ‘fromInput’ : ‘toInput’;
document.getElementById(inputId).value = label;
document.getElementById(field === ‘from’ ? ‘fromSug’ : ‘toSug’).classList.remove(‘open’);
if (field === ‘from’) fromValue = label; else toValue = label;
}
function swapFromTo() {
const fi = document.getElementById(‘fromInput’);
const ti = document.getElementById(‘toInput’);
[fi.value, ti.value] = [ti.value, fi.value];
[fromValue, toValue] = [toValue, fromValue];
}

/* ── Route Switcher ── */
function switchRoute(route, btn) {
activeRoute = route;
document.querySelectorAll(’.route-btn’).forEach(b => b.classList.remove(‘active’));
btn.classList.add(‘active’);

/* show/hide views */
const allViews = [‘dhaka’,‘bakshiganj’,‘jhenaigati’,‘chittagong’,‘khulna’,‘barisal’,‘rajshahi’,‘rangpur’,‘sylhet’];
allViews.forEach(v => {
const el = document.getElementById(`view-${v}`);
if (el) el.style.display = v === route ? ‘’ : ‘none’;
});

/* show/hide dhaka tab nav & stats bar */
const isDhaka = route === ‘dhaka’;
document.getElementById(‘dhakaTabNav’).style.display = isDhaka ? ‘’ : ‘none’;
document.getElementById(‘statsBar’).style.display    = isDhaka ? ‘’ : ‘none’;

/* render appropriate content */
if (route === ‘dhaka’) {
renderAll();
} else if (route === ‘bakshiganj’) {
renderSimpleList(‘bakshiganj-cards’, bakshiganjRoutes, ‘bakshiganj’);
} else if (route === ‘jhenaigati’) {
renderJhenaigatiList();
} else {
renderDivisionCards(route);
}

/* update lang text in new view */
updateLangTexts();
}

/* ── Time Filter ── */
function selectTime(chip, time) {
document.querySelectorAll(’.time-chip’).forEach(c => c.classList.remove(‘active’));
chip.classList.add(‘active’);
activeTimeFilter = time;
const target = time === ‘all’ ? ‘morning’ : time;
showTab(target, document.getElementById(`tab-${target}`));
}

/* ── Tab Navigation ── */
function showTab(tab, btn) {
document.querySelectorAll(’#view-dhaka .section’).forEach(s => s.classList.remove(‘active’));
document.querySelectorAll(’.tab-btn’).forEach(b => b.classList.remove(‘active’));
document.getElementById(tab).classList.add(‘active’);
if (btn) btn.classList.add(‘active’);
}

/* ── Search ── */
function scoreCard(bus, fromQ, toQ) {
const fq = norm(fromQ), tq = norm(toQ);
if (!fq && !tq) return 1;
const busFrom = norm((bus.from || ‘’) + ’ ’ + (bus.fromEn || ‘’));
const busDest = norm((bus.dest || ‘’) + ’ ’ + (bus.destEn || ‘’));
const busAll  = norm([bus.name, bus.nameEn, bus.from, bus.fromEn, bus.dest, bus.destEn, bus.phone].filter(Boolean).join(’ ’));
let score = 0;
if (fq) {
if (busFrom.includes(fq)) score += 2;
else if (busAll.includes(fq)) score += 1;
else return 0;
}
if (tq) {
if (busDest.includes(tq)) score += 2;
else if (busAll.includes(tq)) score += 0.5;
else return 0;
}
return score;
}

function doSearch() {
const fv = document.getElementById(‘fromInput’).value.trim();
const tv = document.getElementById(‘toInput’).value.trim();
fromValue = fv; toValue = tv;

if (activeRoute === ‘dhaka’) {
renderAll();
for (const sec of [‘morning’,‘noon’,‘evening’]) {
if (busData[sec].some(b => scoreCard(b, fv, tv) > 0)) {
showTab(sec, document.getElementById(`tab-${sec}`));
break;
}
}
} else if (activeRoute === ‘bakshiganj’) {
renderSimpleList(‘bakshiganj-cards’, bakshiganjRoutes, ‘bakshiganj’);
} else if (activeRoute === ‘jhenaigati’) {
renderJhenaigatiList();
}
}

/* ── Render: Dhaka Route ── */
function renderAll() {
const isEn = lang === ‘en’;
const fv = fromValue.trim(), tv = toValue.trim();
const filter = activeTimeFilter === ‘all’ ? null : activeTimeFilter;

[‘morning’,‘noon’,‘evening’].forEach(sec => {
const wrap    = document.getElementById(`${sec}-cards`);
const noRes   = document.getElementById(`${sec}-noresult`);
const countEl = document.getElementById(`${sec}-count`);
if (!wrap) return;

```
if (filter && filter !== sec) {
  wrap.innerHTML = ''; countEl.textContent = '0'; noRes.style.display = 'none'; return;
}

const scored = busData[sec]
  .map((b, i) => ({ b, i, score: scoreCard(b, fv, tv) }))
  .filter(x => x.score > 0)
  .sort((a, z) => z.score - a.score || a.i - z.i);

countEl.textContent = scored.length;
if (!scored.length) { wrap.innerHTML = ''; noRes.style.display = 'block'; return; }
noRes.style.display = 'none';

const cls     = sec === 'noon' ? 'card noon' : sec === 'evening' ? 'card evening' : 'card';
const callTxt = isEn ? 'CALL' : 'কল';

wrap.innerHTML = scored.map(({ b, i }, rank) => {
  const name   = hl(isEn ? b.nameEn : b.name,   fv || tv);
  const dest   = hl(isEn ? b.destEn : b.dest,   tv);
  const from   = hl(isEn ? b.fromEn : b.from,   fv);
  const time   = isEn ? b.timeEn   : b.time;
  const period = isEn ? b.periodEn : b.period;
  const digits = phoneDigits(b.phone || '');
  return `
    <div class="${cls}" style="animation-delay:${rank*.04}s">
      <div class="card-left">
        <div class="serial">#${String(i+1).padStart(2,'0')}</div>
        <div class="bus-name">${name}</div>
        <div class="card-meta">
          <span class="meta-chip time">${timeSvg}${time} (${period})</span>
          <span class="meta-chip dest">${pinSvg}${dest}</span>
          <span class="meta-chip place">${pinSvg}${from}</span>
        </div>
        <div class="phone-num">${b.phone || ''}</div>
      </div>
      <a class="call-btn" href="tel:${digits}" aria-label="Call ${b.phone}">
        ${callSvg}<span class="call-label">${callTxt}</span>
      </a>
    </div>`;
}).join('');
```

});

/* update stats */
const bn = lang === ‘bn’;
document.getElementById(‘stat-morning’).textContent = bn ? `সকাল: ${document.getElementById('morning-count').textContent}টি` : `Morning: ${document.getElementById('morning-count').textContent}`;
document.getElementById(‘stat-noon’).textContent    = bn ? `দুপুর-বিকেল: ${document.getElementById('noon-count').textContent}টি` : `Noon-Eve: ${document.getElementById('noon-count').textContent}`;
document.getElementById(‘stat-evening’).textContent = bn ? `সন্ধ্যা-রাত: ${document.getElementById('evening-count').textContent}টি` : `Night: ${document.getElementById('evening-count').textContent}`;
}

/* ── Render: Bakshiganj simple list ── */
function renderSimpleList(containerId, routes, routeKey) {
const wrap = document.getElementById(containerId);
const noRes = document.getElementById(`${routeKey}-noresult`);
if (!wrap) return;

const isEn = lang === ‘en’;
const fv = fromValue.trim(), tv = toValue.trim();

const filtered = routes.filter(b => {
if (!fv && !tv) return true;
const hay = norm([b.name, b.nameEn, b.from, b.fromEn, b.dest, b.destEn, …(b.phones||[])].filter(Boolean).join(’ ’));
if (fv && !hay.includes(norm(fv))) return false;
if (tv && !hay.includes(norm(tv))) return false;
return true;
});

if (!filtered.length) { wrap.innerHTML = ‘’; if (noRes) noRes.style.display = ‘block’; return; }
if (noRes) noRes.style.display = ‘none’;

wrap.innerHTML = filtered.map((b, rank) => {
const name = isEn ? b.nameEn : b.name;
const from = isEn ? b.fromEn : b.from;
const dest = isEn ? b.destEn : b.dest;
const time = isEn ? b.timeEn : b.time;
const period = isEn ? (b.periodEn || ‘’) : (b.period || ‘’);
const phones = b.phones || [];
const pillsHtml = phones.map(p => {
const d = phoneDigits(p);
return `<a class="phone-pill" href="tel:${d}" aria-label="Call ${p}">${callSvg}<span>${p}</span></a>`;
}).join(’’);

```
return `
  <div class="div-card" style="animation-delay:${rank*.04}s">
    <div class="div-card-top">
      <div class="div-card-name">${name}</div>
      <span class="meta-chip time">${timeSvg}${time}${period ? ` (${period})` : ''}</span>
    </div>
    <div class="div-route-info">
      <span class="meta-chip place">${pinSvg}${from}</span>
      <span style="color:var(--text-3);font-size:.75rem;align-self:center">→</span>
      <span class="meta-chip dest">${pinSvg}${dest}</span>
    </div>
    <div class="phone-grid">${pillsHtml}</div>
  </div>`;
```

}).join(’’);
}

/* ── Render: Jhenaigati list (has timeDhaka field) ── */
function renderJhenaigatiList() {
const wrap = document.getElementById(‘jhenaigati-cards’);
const noRes = document.getElementById(‘jhenaigati-noresult’);
if (!wrap) return;

const isEn = lang === ‘en’;
const fv = fromValue.trim(), tv = toValue.trim();

const filtered = jhenaigatiRoutes.filter(b => {
if (!fv && !tv) return true;
const hay = norm([b.name, b.nameEn, b.from, b.fromEn, b.dest, b.destEn, …(b.phones||[])].filter(Boolean).join(’ ’));
if (fv && !hay.includes(norm(fv))) return false;
if (tv && !hay.includes(norm(tv))) return false;
return true;
});

if (!filtered.length) { wrap.innerHTML = ‘’; noRes.style.display = ‘block’; return; }
noRes.style.display = ‘none’;

wrap.innerHTML = filtered.map((b, rank) => {
const name    = isEn ? b.nameEn : b.name;
const from    = isEn ? b.fromEn : b.from;
const dest    = isEn ? b.destEn : b.dest;
const time    = isEn ? b.timeEn : b.time;
const period  = isEn ? (b.periodEn||’’) : (b.period||’’);
const tDhaka  = isEn ? (b.timeDhakaEn||’’) : (b.timeDhaka||’’);
const phones  = b.phones || [];
const pillsHtml = phones.map(p => {
const d = phoneDigits(p);
return `<a class="phone-pill" href="tel:${d}" aria-label="Call ${p}">${callSvg}<span>${p}</span></a>`;
}).join(’’);

```
return `
  <div class="div-card" style="border-left-color:var(--div-jhn);animation-delay:${rank*.04}s">
    <div class="div-card-top">
      <div class="div-card-name">${name}</div>
      <span class="meta-chip time">${timeSvg}${time}</span>
    </div>
    <div class="div-route-info">
      <span class="meta-chip place">${pinSvg}${from}</span>
      <span style="color:var(--text-3);font-size:.75rem;align-self:center">→</span>
      <span class="meta-chip dest">${pinSvg}${dest}</span>
    </div>
    ${tDhaka ? `<div class="div-time-row">${timeSvg}<span>${isEn?'Arrives Dhaka:':'ঢাকা পৌঁছায়:'} <strong>${tDhaka}</strong></span></div>` : ''}
    <div class="phone-grid">${pillsHtml}</div>
  </div>`;
```

}).join(’’);
}

/* ── Render: Division cards ── */
function renderDivisionCards(key) {
const data = divisionRoutes[key];
const wrap = document.getElementById(`${key}-cards`);
if (!wrap || !data) return;

const isEn = lang === ‘en’;
const colors = {chittagong:’#ef4444’,khulna:’#0891b2’,barisal:’#8b5cf6’,rajshahi:’#f97316’,rangpur:’#10b981’,sylhet:’#ec4899’};
const col = colors[key] || ‘var(–primary)’;

wrap.innerHTML = data.map((b, rank) => {
const name      = isEn ? b.nameEn : b.name;
const from      = isEn ? b.fromEn : b.from;
const dest      = isEn ? b.destEn : b.dest;
const timeFrom  = isEn ? b.timeFromEn : b.timeFrom;
const timeTo    = isEn ? b.timeToEn   : b.timeTo;
const phones    = b.phones || [];
const pillsHtml = phones.map(p => {
const d = phoneDigits(p);
return `<a class="phone-pill" href="tel:${d}" aria-label="Call ${p}">${callSvg}<span>${p}</span></a>`;
}).join(’’);

```
return `
  <div class="div-card" style="border-left-color:${col};animation-delay:${rank*.05}s">
    <div class="div-card-top">
      <div class="div-card-name">${name}</div>
    </div>
    <div class="div-route-info">
      <span class="meta-chip place">${pinSvg}${from}</span>
      <span style="color:var(--text-3);font-size:.75rem;align-self:center">→</span>
      <span class="meta-chip dest">${pinSvg}${dest}</span>
    </div>
    <div class="div-time-row">
      ${timeSvg}
      <span>${isEn?'Departs':'ছাড়ে'}: <strong>${timeFrom}</strong></span>
      ${timeTo ? `&nbsp;·&nbsp;<span>${isEn?'Arrives':'পৌঁছায়'}: <strong>${timeTo}</strong></span>` : ''}
    </div>
    <div class="phone-grid">${pillsHtml}</div>
  </div>`;
```

}).join(’’);
}

/* ── Language ── */
function updateLangTexts() {
const l = lang;
document.querySelectorAll(’[data-bn]’).forEach(el => {
el.textContent = el.dataset[l] || el.dataset.bn;
});
document.querySelectorAll(’.tab-label’).forEach(el => {
el.textContent = el.dataset[l] || el.dataset.bn;
});
document.querySelectorAll(’.section-head h2, .no-results p’).forEach(el => {
if (el.dataset[l]) el.textContent = el.dataset[l];
});

const fi = document.getElementById(‘fromInput’);
const ti = document.getElementById(‘toInput’);
fi.placeholder = l === ‘bn’ ? fi.dataset.placeholderBn : fi.dataset.placeholderEn;
ti.placeholder = l === ‘bn’ ? ti.dataset.placeholderBn : ti.dataset.placeholderEn;
}

function setLang(l) {
lang = l;
document.getElementById(‘btnBN’).classList.toggle(‘active’, l === ‘bn’);
document.getElementById(‘btnEN’).classList.toggle(‘active’, l === ‘en’);
document.documentElement.lang = l;

const titles = { bn: ‘শেরপুর বাস সময়সূচি’, en: ‘Sherpur Bus Schedule’ };
const subs   = { bn: ‘সকল রুটের বাস ও যোগাযোগ নম্বর’, en: ‘All routes, schedules & contacts’ };
document.getElementById(‘heroTitle’).textContent = titles[l];
document.getElementById(‘heroSub’).textContent   = subs[l];

const labels = {
from:    { bn:‘যাত্রা শুরু’,  en:‘From’ },
to:      { bn:‘গন্তব্য’,      en:‘To’ },
all:     { bn:‘সব সময়’,      en:‘All Time’ },
morning: { bn:‘সকাল’,         en:‘Morning’ },
noon:    { bn:‘দুপুর-বিকেল’, en:‘Noon-Eve’ },
evening: { bn:‘সন্ধ্যা-রাত’, en:‘Night’ },
cta:     { bn:‘বাস খুঁজুন’,  en:‘Find Buses’ },
};
document.getElementById(‘labelFrom’).textContent  = labels.from[l];
document.getElementById(‘labelTo’).textContent    = labels.to[l];
document.getElementById(‘tcAll’).textContent      = labels.all[l];
document.getElementById(‘tcMorning’).textContent  = labels.morning[l];
document.getElementById(‘tcNoon’).textContent     = labels.noon[l];
document.getElementById(‘tcEvening’).textContent  = labels.evening[l];
document.getElementById(‘ctaLabel’).textContent   = labels.cta[l];

updateLangTexts();

/* re-render current view */
if (activeRoute === ‘dhaka’) renderAll();
else if (activeRoute === ‘bakshiganj’) renderSimpleList(‘bakshiganj-cards’, bakshiganjRoutes, ‘bakshiganj’);
else if (activeRoute === ‘jhenaigati’) renderJhenaigatiList();
else renderDivisionCards(activeRoute);
}

/* ── Init ── */
document.addEventListener(‘DOMContentLoaded’, () => {
renderAll();
/* pre-render all other views silently */
renderSimpleList(‘bakshiganj-cards’, bakshiganjRoutes, ‘bakshiganj’);
renderJhenaigatiList();
[‘chittagong’,‘khulna’,‘barisal’,‘rajshahi’,‘rangpur’,‘sylhet’].forEach(k => renderDivisionCards(k));
});