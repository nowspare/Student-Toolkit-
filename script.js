'use strict';

/* ============================================================
   StudyKit -- student utility toolkit
   Architecture:
     - TOOLS registry (id/name/cat/render)
     - hash router (#/, #/c/cat, #/tool/id)
     - localStorage persistence (all keys namespaced 'sk:')
     - 5 themes applied via [data-theme] on <html>
   ============================================================ */

/* ---------------- Storage ---------------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('sk:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('sk:' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('sk:' + k); } catch {} }
};

/* ---------------- DOM helpers ---------------- */
const app = document.getElementById('app');
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
function copyText(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(() => toast('Copied', 'success'), () => toast('Copy failed', 'error'));
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function fmtNum(n, d = 2) {
  if (!isFinite(n)) return '--';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function readFile(file, as = 'text') {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    if (as === 'text') r.readAsText(file);
    else if (as === 'dataurl') r.readAsDataURL(file);
    else if (as === 'arraybuffer') r.readAsArrayBuffer(file);
  });
}
function loadScript(src) {
  return new Promise((res, rej) => {
    if ([...document.scripts].some(s => s.src === src)) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

/* Tool-scoped intervals -- cleared on every render */
let toolTimers = [];
function toolInterval(fn, ms) { const id = setInterval(fn, ms); toolTimers.push(id); return id; }
function clearToolTimers() { toolTimers.forEach(clearInterval); toolTimers = []; }

/* ---------------- Themes ---------------- */
const THEMES = [
  { id: 'pure-minimal', name: 'Pure Minimal', swatch: '#2f3542' },
  { id: 'midnight', name: 'Midnight', swatch: '#0b0d10' },
  { id: 'warm-paper', name: 'Warm Paper', swatch: '#6b4f2f' },
  { id: 'sage-garden', name: 'Sage Garden', swatch: '#4f6b3e' },
  { id: 'lavender-mist', name: 'Lavender Mist', swatch: '#6c5b9e' }
];
function applyTheme(id) {
  if (!THEMES.some(t => t.id === id)) id = 'pure-minimal';
  document.documentElement.dataset.theme = id;
  LS.set('theme', id);
  $$('.theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === id));
}
function buildThemeSwitcher() {
  const root = document.getElementById('themeSwitcher');
  root.innerHTML = THEMES.map(t => `
    <button class="theme-opt" data-theme="${t.id}">
      <span class="swatch" style="background:${t.swatch}"></span>
      <span>${t.name}</span>
    </button>
  `).join('');
  root.addEventListener('click', e => {
    const btn = e.target.closest('.theme-opt');
    if (btn) applyTheme(btn.dataset.theme);
  });
}

/* ---------------- Tool registry ---------------- */
const CATS = {
  math: 'Mathematics',
  study: 'Study & Academic',
  writing: 'Writing & Text',
  daily: 'Daily Life',
  files: 'Files & Documents',
  prod: 'Productivity'
};
const TOOLS = [];
function T(id, name, cat, render, kw = '') {
  TOOLS.push({ id, name, cat, render, kw });
}
function monogram(name) {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2);
  return (words[0][0] + words[1][0]).toUpperCase();
}
function toolCard(t) {
  return `<button class="card" data-tool="${t.id}">
    <span class="mono">${monogram(t.name)}</span>
    <span class="meta"><span class="name">${esc(t.name)}</span><span class="cat">${CATS[t.cat]}</span></span>
  </button>`;
}

/* ---------------- Favorites / recents ---------------- */
function getFavs() { return LS.get('favs', []); }
function getRecents() { return LS.get('recents', []); }
function pushRecent(id) {
  const r = getRecents().filter(x => x !== id);
  r.unshift(id);
  LS.set('recents', r.slice(0, 8));
}

/* ============================================================
   ROUTER
   ============================================================ */
function onRoute() {
  clearToolTimers();
  const hash = location.hash || '#/';
  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
  if (hash === '#/' || hash === '#') return renderDashboard();
  const m1 = hash.match(/^#\/c\/(\w+)/); if (m1) return renderCategory(m1[1]);
  const m2 = hash.match(/^#\/tool\/([\w-]+)/); if (m2) return renderTool(m2[1]);
  renderDashboard();
}
window.addEventListener('hashchange', onRoute);

/* ---------------- Dashboard ---------------- */
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Still up?';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Late night';
}
function fmtTime(d) {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
function renderDashboard() {
  const favs = getFavs().map(id => TOOLS.find(t => t.id === id)).filter(Boolean);
  const recent = getRecents().map(id => TOOLS.find(t => t.id === id)).filter(Boolean);
  const popular = ['gpa-calculator','pomodoro','word-counter','password-generator','pdf-merger','to-do','flip-card','percentage-calc']
    .map(id => TOOLS.find(t => t.id === id)).filter(Boolean);

  const tasks = LS.get('todo', []);
  const habits = LS.get('habits', []);
  const notes = LS.get('notes', []);
  const todayHabitsDone = habits.reduce((n, h) => {
    const k = h.log?.[todayKey()];
    return n + (k ? 1 : 0);
  }, 0);
  const tasksDone = tasks.filter(t => t.done).length;

  app.innerHTML = `
    <section class="hero">
      <div>
        <div class="greeting">${greeting()}, Kai</div>
        <div class="date" id="dateStr"></div>
      </div>
      <div class="clock" id="clockLive">${fmtTime(new Date())}</div>
    </section>

    <div class="stat-grid">
      <div class="stat-card"><div class="v">${tasksDone}/${tasks.length}</div><div class="l">Tasks done</div></div>
      <div class="stat-card"><div class="v">${todayHabitsDone}/${habits.length}</div><div class="l">Habits today</div></div>
      <div class="stat-card"><div class="v">${notes.length}</div><div class="l">Notes saved</div></div>
      <div class="stat-card"><div class="v">70</div><div class="l">Tools available</div></div>
    </div>

    ${favs.length ? `<section class="section">
      <div class="section-head"><h2>Favorites</h2></div>
      <div class="grid">${favs.map(toolCard).join('')}</div>
    </section>` : ''}

    ${recent.length ? `<section class="section">
      <div class="section-head"><h2>Recently used</h2></div>
      <div class="grid">${recent.map(toolCard).join('')}</div>
    </section>` : ''}

    <section class="section">
      <div class="section-head"><h2>Popular tools</h2></div>
      <div class="grid">${popular.map(toolCard).join('')}</div>
    </section>

    <section class="section">
      <div class="section-head"><h2>All tools</h2><span class="link">${TOOLS.length} available</span></div>
      <div class="grid">${TOOLS.map(toolCard).join('')}</div>
    </section>
  `;

  document.getElementById('dateStr').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  toolInterval(() => {
    const el = document.getElementById('clockLive');
    if (el) el.textContent = fmtTime(new Date());
  }, 1000);

  app.addEventListener('click', e => {
    const c = e.target.closest('[data-tool]');
    if (c) location.hash = '#/tool/' + c.dataset.tool;
  }, { once: true });
}

/* ---------------- Category page ---------------- */
function renderCategory(cat) {
  if (!CATS[cat]) return renderDashboard();
  const list = TOOLS.filter(t => t.cat === cat);
  app.innerHTML = `
    <div class="tool-head">
      <button class="btn-ghost" data-back>← Back</button>
      <h1>${CATS[cat]}</h1>
    </div>
    <div class="grid">${list.map(toolCard).join('')}</div>
  `;
  $('[data-back]').onclick = () => location.hash = '#/';
  app.addEventListener('click', e => {
    const c = e.target.closest('[data-tool]');
    if (c) location.hash = '#/tool/' + c.dataset.tool;
  }, { once: true });
}

/* ---------------- Tool page ---------------- */
function renderTool(id) {
  const tool = TOOLS.find(t => t.id === id);
  if (!tool) {
    app.innerHTML = `<div class="tool-head"><h1>Not found</h1></div><p class="muted">That tool doesn't exist.</p>`;
    return;
  }
  pushRecent(id);
  const favs = getFavs();
  const isFav = favs.includes(id);
  app.innerHTML = `
    <div class="tool-head">
      <button class="btn-ghost" data-back>← Back</button>
      <h1>${esc(tool.name)}</h1>
      <button class="btn-ghost star ${isFav ? 'on' : ''}" id="favBtn">${isFav ? '★' : '☆'} Favorite</button>
    </div>
    <div class="tool-body" id="toolBody"></div>
  `;
  $('[data-back]').onclick = () => location.hash = '#/';
  $('#favBtn').onclick = () => {
    const list = getFavs();
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    LS.set('favs', list);
    const on = list.includes(id);
    const btn = $('#favBtn');
    btn.classList.toggle('on', on);
    btn.textContent = (on ? '★' : '☆') + ' Favorite';
  };
  try { tool.render($('#toolBody')); }
  catch (e) { $('#toolBody').innerHTML = `<p class="result error">This tool failed to render: ${esc(e.message)}</p>`; console.error(e); }
}

/* ---------------- Search ---------------- */
const searchInput = document.getElementById('search');
const searchResults = document.getElementById('searchResults');
function runSearch(q) {
  q = q.trim().toLowerCase();
  if (!q) { searchResults.hidden = true; searchResults.innerHTML = ''; return; }
  const hits = TOOLS.filter(t =>
    t.name.toLowerCase().includes(q) ||
    (t.kw || '').toLowerCase().includes(q) ||
    CATS[t.cat].toLowerCase().includes(q)
  ).slice(0, 12);
  if (!hits.length) {
    searchResults.innerHTML = `<div class="empty">No tools match "${esc(q)}".</div>`;
  } else {
    searchResults.innerHTML = hits.map(t =>
      `<a href="#/tool/${t.id}"><strong>${esc(t.name)}</strong><br><span class="muted tiny">${CATS[t.cat]}</span></a>`
    ).join('');
  }
  searchResults.hidden = false;
}
searchInput.addEventListener('input', e => runSearch(e.target.value));
searchInput.addEventListener('focus', () => { if (searchInput.value) runSearch(searchInput.value); });
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) { searchResults.hidden = true; }
});
searchResults.addEventListener('click', () => { searchResults.hidden = true; searchInput.value = ''; });

/* ============================================================
   TOOLS -- 70 implementations
   ============================================================ */

/* ---------- Shared unit converter factory ---------- */
function unitConverter(units) {
  return el => {
    const opts = Object.keys(units).map(u => `<option>${u}</option>`).join('');
    el.innerHTML = `
      <div class="field-row">
        <input type="number" class="inp" id="val" value="1" step="any">
        <select class="inp" id="from">${opts}</select>
      </div>
      <div class="row"><button class="btn-ghost" id="swap">⇅ Swap</button>
        <button class="btn-ghost" id="copy">Copy result</button></div>
      <div class="field-row">
        <input type="number" class="inp" id="res" step="any" readonly>
        <select class="inp" id="to">${opts}</select>
      </div>
      <p class="tiny muted">Result is auto-computed as you type.</p>
    `;
    const $v = el.querySelector('#val'), $f = el.querySelector('#from'), $t = el.querySelector('#to'), $r = el.querySelector('#res');
    function conv() {
      const n = parseFloat($v.value);
      if (!isFinite(n)) { $r.value = ''; return; }
      $r.value = +(n * units[$f.value] / units[$t.value]).toFixed(8);
    }
    ['input','change'].forEach(ev => {
      $v.addEventListener(ev, conv); $f.addEventListener(ev, conv); $t.addEventListener(ev, conv);
    });
    el.querySelector('#swap').onclick = () => {
      const a = $f.value, b = $t.value;
      $f.value = b; $t.value = a; conv();
    };
    el.querySelector('#copy').onclick = () => copyText($r.value);
    conv();
  };
}

/* ============================================================
   A. MATHEMATICS (1–12)
   ============================================================ */

/* 1. Scientific Calculator */
function evalExpr(input) {
  let expr = String(input).trim();
  if (!expr) throw new Error('Empty expression');
  expr = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi');
  if (!/^[0-9+\-*/().,%\s a-zA-Z^]+$/.test(expr)) throw new Error('Invalid character');
  const ids = expr.match(/[a-zA-Z]+/g) || [];
  const safe = { sqrt:1, sin:1, cos:1, tan:1, log:1, ln:1, abs:1, exp:1, round:1, floor:1, ceil:1, pi:1, e:1 };
  for (const id of ids) if (!safe[id]) throw new Error('Unknown: ' + id);
  expr = expr.replace(/\^/g, '**');
  const fn = new Function('sqrt','sin','cos','tan','log','ln','abs','exp','round','floor','ceil','pi','e',
    '"use strict";return (' + expr + ');');
  const r = fn(Math.sqrt, Math.sin, Math.cos, Math.tan, Math.log10, Math.log, Math.abs, Math.exp,
               Math.round, Math.floor, Math.ceil, Math.PI, Math.E);
  if (typeof r !== 'number' || !isFinite(r)) throw new Error('Invalid result');
  return r;
}

T('sci-calc', 'Scientific Calculator', 'math', el => {
  el.innerHTML = `
    <div class="calc-display"><div class="hist" id="hist"></div><div id="disp">0</div></div>
    <div class="calc-grid" id="pad"></div>
    <p class="tiny muted">Supports + − * / ^ ( ) and functions: sqrt, sin, cos, tan, log, ln, abs, exp, round, floor, ceil, pi, e.</p>
  `;
  const disp = el.querySelector('#disp'), hist = el.querySelector('#hist');
  let expr = '';
  const keys = [
    ['C','('],[')','ac'],['sqrt','fn'],['^','op'],['/','op'],
    ['7','num'],['8','num'],['9','num'],['*','op'],
    ['4','num'],['5','num'],['6','num'],['-','op'],
    ['1','num'],['2','num'],['3','num'],['+','op'],
    ['0','num'],['.','num'],['=','eq']
  ];
  const pad = el.querySelector('#pad');
  pad.innerHTML = keys.map(([k, cls]) => `<button data-k="${k}" class="${cls === 'op' ? 'op' : cls === 'eq' ? 'eq' : cls === 'num' ? '' : ''}">${k}</button>`).join('');
  pad.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.k;
    if (k === 'C' || k === 'ac') { expr = ''; disp.textContent = '0'; hist.textContent = ''; return; }
    if (k === '=') {
      try { const r = evalExpr(expr || '0'); hist.textContent = expr + ' ='; expr = String(r); disp.textContent = r; }
      catch (e) { hist.textContent = ''; disp.textContent = 'Error'; }
      return;
    }
    if (k === 'sqrt') { expr += 'sqrt('; }
    else expr += k;
    disp.textContent = expr || '0';
  });
});

/* 2. Basic Calculator */
T('basic-calc', 'Basic Calculator', 'math', el => {
  el.innerHTML = `
    <div class="calc-display"><div id="disp2">0</div></div>
    <div class="calc-grid" id="pad2" style="grid-template-columns:repeat(4,1fr)"></div>
  `;
  const disp = el.querySelector('#disp2');
  let cur = '0', prev = null, op = null, reset = false;
  const keys = ['C','⌫','÷','×','7','8','9','−','4','5','6','+','1','2','3','=','0','.',''];
  const pad = el.querySelector('#pad2');
  pad.innerHTML = keys.map(k => k ? `<button data-k="${k}" class="${['÷','×','−','+'].includes(k) ? 'op' : ''} ${k==='='?'eq':''}">${k}</button>` : '').join('');
  function show() { disp.textContent = cur.length > 14 ? (+cur).toExponential(6) : cur; }
  pad.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.k;
    if (!k) return;
    if (k === 'C') { cur = '0'; prev = null; op = null; reset = false; show(); return; }
    if (k === '⌫') { cur = cur.length > 1 ? cur.slice(0, -1) : '0'; show(); return; }
    if (['÷','×','−','+'].includes(k)) {
      if (op !== null && !reset) { cur = String(calc(prev, +cur, op)); }
      prev = +cur; op = k; reset = true; show(); return;
    }
    if (k === '=') {
      if (op === null) return;
      cur = String(calc(prev, +cur, op)); op = null; prev = null; reset = true; show(); return;
    }
    if (k === '.') { if (!cur.includes('.')) cur += '.'; else if (reset) cur = '0.'; reset = false; show(); return; }
    if (reset) { cur = k; reset = false; } else { cur = cur === '0' ? k : cur + k; }
    show();
  });
  function calc(a, b, o) {
    switch (o) { case '+': return a + b; case '−': return a - b; case '×': return a * b; case '÷': return b === 0 ? NaN : a / b; }
    return b;
  }
});

/* 3. Percentage Calculator */
T('percentage-calc', 'Percentage Calculator', 'math', el => {
  el.innerHTML = `
    <div class="row">
      <select class="inp" id="mode">
        <option value="pct-of">X% of Y</option>
        <option value="is-what">X is what % of Y</option>
        <option value="change">% change from X to Y</option>
        <option value="add">Y + X%</option>
        <option value="sub">Y − X%</option>
      </select>
    </div>
    <div class="field-row">
      <input type="number" class="inp" id="a" placeholder="Value A" step="any">
      <input type="number" class="inp" id="b" placeholder="Value B" step="any">
    </div>
    <div class="result big" id="out">--</div>
  `;
  const mode = el.querySelector('#mode'), A = el.querySelector('#a'), B = el.querySelector('#b'), out = el.querySelector('#out');
  function run() {
    const a = parseFloat(A.value), b = parseFloat(B.value);
    if (!isFinite(a) || !isFinite(b)) { out.textContent = '--'; out.classList.remove('error'); return; }
    let r;
    switch (mode.value) {
      case 'pct-of': r = (a / 100) * b; out.textContent = fmtNum(r, 4); break;
      case 'is-what': r = (a / b) * 100; out.textContent = b === 0 ? 'Cannot divide by zero' : fmtNum(r, 4) + '%'; break;
      case 'change': r = b === 0 ? NaN : ((b - a) / a) * 100; out.textContent = isFinite(r) ? (r >= 0 ? '+' : '') + fmtNum(r, 4) + '%' : '--'; break;
      case 'add': r = b * (1 + a / 100); out.textContent = fmtNum(r, 4); break;
      case 'sub': r = b * (1 - a / 100); out.textContent = fmtNum(r, 4); break;
    }
  }
  [mode, A, B].forEach(x => x.addEventListener('input', run));
  run();
});

/* 4. Fraction Calculator */
function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a); }
T('fraction-calc', 'Fraction Calculator', 'math', el => {
  el.innerHTML = `
    <div class="field-row"><input type="number" class="inp" id="n1" placeholder="num 1"><input type="number" class="inp" id="d1" placeholder="den 1"></div>
    <div class="row"><select class="inp" id="op" style="max-width:120px"><option>+</option><option>−</option><option>×</option><option>÷</option></select></div>
    <div class="field-row"><input type="number" class="inp" id="n2" placeholder="num 2"><input type="number" class="inp" id="d2" placeholder="den 2"></div>
    <div class="result big" id="out">--</div>
  `;
  const g = id => el.querySelector('#' + id);
  function run() {
    const n1 = parseInt(g('n1').value), d1 = parseInt(g('d1').value),
          n2 = parseInt(g('n2').value), d2 = parseInt(g('d2').value), op = g('op').value;
    if (![n1,d1,n2,d2].every(Number.isFinite) || d1 === 0 || d2 === 0) { g('out').textContent = '--'; return; }
    let n, d;
    if (op === '+') { n = n1*d2 + n2*d1; d = d1*d2; }
    else if (op === '−') { n = n1*d2 - n2*d1; d = d1*d2; }
    else if (op === '×') { n = n1*n2; d = d1*d2; }
    else { if (n2 === 0) { g('out').textContent = 'Cannot divide by zero'; return; } n = n1*d2; d = d1*n2; }
    const gg = gcd(n, d);
    n /= gg; d /= gg;
    if (d < 0) { n = -n; d = -d; }
    g('out').textContent = d === 1 ? String(n) : `${n}/${d}  (${fmtNum(n/d, 4)})`;
  }
  el.addEventListener('input', run);
  run();
});

/* 5. Average Calculator */
T('average-calc', 'Average Calculator', 'math', el => {
  el.innerHTML = `
    <textarea class="inp" id="nums" placeholder="Enter numbers separated by commas, spaces, or newlines"></textarea>
    <div class="row"><button class="btn" id="run">Calculate</button><button class="btn-ghost" id="clr">Clear</button></div>
    <div class="stats-inline" id="out"></div>
  `;
  const nums = el.querySelector('#nums'), out = el.querySelector('#out');
  el.querySelector('#run').onclick = () => {
    const arr = nums.value.split(/[\s,]+/).map(Number).filter(Number.isFinite);
    if (!arr.length) { out.innerHTML = '<div class="result error">Enter at least one number</div>'; return; }
    const sum = arr.reduce((a, b) => a + b, 0);
    const mean = sum / arr.length;
    const sorted = [...arr].sort((a, b) => a - b);
    const median = sorted.length % 2 ? sorted[(sorted.length-1)/2] : (sorted[sorted.length/2-1] + sorted[sorted.length/2]) / 2;
    const counts = {}; arr.forEach(n => counts[n] = (counts[n]||0)+1);
    const maxC = Math.max(...Object.values(counts));
    const modes = Object.keys(counts).filter(k => counts[k] === maxC);
    out.innerHTML = `
      <div class="stat"><span class="stat-v">${fmtNum(mean, 4)}</span><span class="stat-l">Mean</span></div>
      <div class="stat"><span class="stat-v">${fmtNum(median, 4)}</span><span class="stat-l">Median</span></div>
      <div class="stat"><span class="stat-v">${maxC > 1 ? modes.join(', ') : 'None'}</span><span class="stat-l">Mode</span></div>
      <div class="stat"><span class="stat-v">${fmtNum(sum, 4)}</span><span class="stat-l">Sum</span></div>
      <div class="stat"><span class="stat-v">${sorted[0]}</span><span class="stat-l">Min</span></div>
      <div class="stat"><span class="stat-v">${sorted[sorted.length-1]}</span><span class="stat-l">Max</span></div>
      <div class="stat"><span class="stat-v">${arr.length}</span><span class="stat-l">Count</span></div>
    `;
  };
  el.querySelector('#clr').onclick = () => { nums.value = ''; out.innerHTML = ''; };
});

/* 6. Ratio Calculator */
T('ratio-calc', 'Ratio Calculator', 'math', el => {
  el.innerHTML = `
    <div class="field-row"><input type="number" class="inp" id="a" placeholder="a"><input type="number" class="inp" id="b" placeholder="b"></div>
    <div class="tiny muted">=</div>
    <div class="field-row"><input type="number" class="inp" id="c" placeholder="c"><input type="number" class="inp" id="d" placeholder="d (leave blank to solve)"></div>
    <div class="result big" id="out">--</div>
  `;
  const g = id => el.querySelector('#' + id);
  function run() {
    const a = parseFloat(g('a').value), b = parseFloat(g('b').value), c = parseFloat(g('c').value), d = parseFloat(g('d').value);
    if (isFinite(a) && isFinite(b) && isFinite(c) && !isFinite(d)) {
      if (a === 0) { g('out').textContent = 'Cannot divide by zero'; return; }
      g('out').textContent = 'd = ' + fmtNum((b * c) / a, 6);
    } else if (isFinite(a) && isFinite(b) && isFinite(d) && !isFinite(c)) {
      if (b === 0) { g('out').textContent = 'Cannot divide by zero'; return; }
      g('out').textContent = 'c = ' + fmtNum((a * d) / b, 6);
    } else {
      g('out').textContent = 'Fill 3 of 4 fields';
    }
  }
  el.addEventListener('input', run);
});

/* 7–12. Unit converters */
T('unit-conv', 'Unit Converter', 'math', unitConverter({
  'Meter': 1, 'Kilometer': 1000, 'Centimeter': 0.01, 'Millimeter': 0.001,
  'Inch': 0.0254, 'Foot': 0.3048, 'Yard': 0.9144, 'Mile': 1609.344,
  'Kilogram': 1, 'Gram': 0.001, 'Pound': 0.45359237, 'Ounce': 0.0283495,
  'Liter': 1, 'Milliliter': 0.001, 'Gallon (US)': 3.78541
}));
T('length-conv', 'Length Converter', 'math', unitConverter({
  'Meter': 1, 'Kilometer': 1000, 'Centimeter': 0.01, 'Millimeter': 0.001,
  'Micrometer': 1e-6, 'Nanometer': 1e-9, 'Inch': 0.0254, 'Foot': 0.3048,
  'Yard': 0.9144, 'Mile': 1609.344, 'Nautical mile': 1852
}));
T('weight-conv', 'Weight Converter', 'math', unitConverter({
  'Kilogram': 1, 'Gram': 0.001, 'Milligram': 1e-6, 'Tonne': 1000,
  'Pound': 0.45359237, 'Ounce': 0.028349523, 'Stone': 6.35029318
}));
T('temp-conv', 'Temperature Converter', 'math', el => {
  el.innerHTML = `
    <div class="field-row">
      <input type="number" class="inp" id="val" value="0" step="any">
      <select class="inp" id="from"><option>°C</option><option>°F</option><option>K</option></select>
    </div>
    <div class="field-row">
      <input type="number" class="inp" id="res" readonly step="any">
      <select class="inp" id="to"><option>°C</option><option>°F</option><option>K</option></select>
    </div>
    <p class="tiny muted">Values update instantly.</p>
  `;
  const g = id => el.querySelector('#' + id);
  function toC(v, u) { return u === '°C' ? v : u === '°F' ? (v - 32) * 5/9 : v - 273.15; }
  function fromC(c, u) { return u === '°C' ? c : u === '°F' ? c * 9/5 + 32 : c + 273.15; }
  function run() {
    const v = parseFloat(g('val').value);
    if (!isFinite(v)) { g('res').value = ''; return; }
    g('res').value = +fromC(toC(v, g('from').value), g('to').value).toFixed(4);
  }
  el.addEventListener('input', run); run();
});
T('time-conv', 'Time Converter', 'math', unitConverter({
  'Second': 1, 'Millisecond': 0.001, 'Minute': 60, 'Hour': 3600,
  'Day': 86400, 'Week': 604800, 'Month (30d)': 2592000, 'Year (365d)': 31536000
}));
T('speed-conv', 'Speed Converter', 'math', unitConverter({
  'Meter/second': 1, 'Kilometer/hour': 0.277778, 'Mile/hour': 0.44704,
  'Knot': 0.514444, 'Foot/second': 0.3048
}));

/* ============================================================
   B. STUDY (13–24)
   ============================================================ */

/* 13. GPA Calculator */
const GRADE_POINTS = { 'A+': 4.0, 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D': 1.0, 'F': 0 };
T('gpa-calc', 'GPA Calculator', 'study', el => {
  el.innerHTML = `
    <div id="rows"></div>
    <div class="row" style="margin-top:10px"><button class="btn-ghost" id="add">+ Add course</button></div>
    <div class="result big" id="out">GPA: --</div>
  `;
  const rows = el.querySelector('#rows'), out = el.querySelector('#out');
  function rowHTML() {
    return `<div class="list-item" style="margin-bottom:6px">
      <input class="inp" placeholder="Course" style="flex:2">
      <input type="number" class="inp" placeholder="Credits" style="flex:0 0 90px;min-width:70px" value="3" min="0">
      <select class="inp" style="flex:0 0 90px;min-width:80px">
        ${Object.keys(GRADE_POINTS).map(g => `<option>${g}</option>`).join('')}
      </select>
      <button class="x" type="button">×</button>
    </div>`;
  }
  function addRow() { rows.insertAdjacentHTML('beforeend', rowHTML()); }
  function calc() {
    let pts = 0, cr = 0;
    rows.querySelectorAll('.list-item').forEach(r => {
      const c = parseFloat(r.querySelectorAll('input')[1].value) || 0;
      const g = r.querySelector('select').value;
      pts += c * GRADE_POINTS[g]; cr += c;
    });
    out.textContent = 'GPA: ' + (cr ? fmtNum(pts / cr, 3) : '--');
  }
  addRow(); addRow();
  el.querySelector('#add').onclick = () => { addRow(); calc(); };
  rows.addEventListener('input', calc);
  rows.addEventListener('change', calc);
  rows.addEventListener('click', e => {
    if (e.target.classList.contains('x')) { e.target.closest('.list-item').remove(); calc(); }
  });
});

/* 14. CGPA Calculator */
T('cgpa-calc', 'CGPA Calculator', 'study', el => {
  el.innerHTML = `
    <div id="rows"></div>
    <div class="row" style="margin-top:10px"><button class="btn-ghost" id="add">+ Add semester</button></div>
    <div class="result big" id="out">CGPA: --</div>
  `;
  const rows = el.querySelector('#rows'), out = el.querySelector('#out');
  function addRow() {
    rows.insertAdjacentHTML('beforeend', `<div class="list-item" style="margin-bottom:6px">
      <input class="inp" placeholder="Semester" style="flex:1">
      <input type="number" class="inp" placeholder="GPA" step="0.01" style="flex:0 0 90px">
      <input type="number" class="inp" placeholder="Credits" style="flex:0 0 90px" value="20">
      <button class="x" type="button">×</button>
    </div>`);
  }
  function calc() {
    let pts = 0, cr = 0;
    rows.querySelectorAll('.list-item').forEach(r => {
      const ins = r.querySelectorAll('input');
      const g = parseFloat(ins[1].value), c = parseFloat(ins[2].value);
      if (isFinite(g) && isFinite(c)) { pts += g * c; cr += c; }
    });
    out.textContent = 'CGPA: ' + (cr ? fmtNum(pts / cr, 3) : '--');
  }
  addRow(); addRow();
  el.querySelector('#add').onclick = () => { addRow(); };
  rows.addEventListener('input', calc);
  rows.addEventListener('click', e => { if (e.target.classList.contains('x')) { e.target.closest('.list-item').remove(); calc(); } });
});

/* 15. Percentage to Grade */
T('pct-to-grade', 'Percentage to Grade', 'study', el => {
  el.innerHTML = `
    <input type="number" class="inp" id="p" placeholder="Percentage (0–100)" min="0" max="100" step="any">
    <div class="result big" id="out">--</div>
    <p class="tiny muted">Standard scale: 90+ A, 80+ B, 70+ C, 60+ D, else F. Adjust expectations to your institution.</p>
  `;
  const p = el.querySelector('#p'), out = el.querySelector('#out');
  p.addEventListener('input', () => {
    const v = parseFloat(p.value);
    if (!isFinite(v) || v < 0 || v > 100) { out.textContent = '--'; return; }
    let g;
    if (v >= 90) g = 'A'; else if (v >= 80) g = 'B'; else if (v >= 70) g = 'C'; else if (v >= 60) g = 'D'; else g = 'F';
    out.textContent = g + '  (' + fmtNum(v, 1) + '%)';
  });
});

/* 16. Marks Calculator */
T('marks-calc', 'Marks Calculator', 'study', el => {
  el.innerHTML = `
    <div class="row">
      <input type="number" class="inp" id="ob" placeholder="Obtained marks" step="any">
      <input type="number" class="inp" id="tot" placeholder="Total marks" step="any">
    </div>
    <div class="stats-inline" id="out"></div>
  `;
  const g = id => el.querySelector('#' + id);
  function run() {
    const ob = parseFloat(g('ob').value), tot = parseFloat(g('tot').value);
    if (!isFinite(ob) || !isFinite(tot) || tot <= 0) { g('out').innerHTML = ''; return; }
    const pct = (ob / tot) * 100;
    let g2;
    if (pct >= 90) g2 = 'A'; else if (pct >= 80) g2 = 'B'; else if (pct >= 70) g2 = 'C'; else if (pct >= 60) g2 = 'D'; else g2 = 'F';
    g('out').innerHTML = `
      <div class="stat"><span class="stat-v">${fmtNum(pct, 2)}%</span><span class="stat-l">Percentage</span></div>
      <div class="stat"><span class="stat-v">${g2}</span><span class="stat-l">Grade</span></div>
      <div class="stat"><span class="stat-v">${fmtNum(tot - ob, 2)}</span><span class="stat-l">Missed</span></div>
    `;
  }
  el.addEventListener('input', run);
});

/* 17. Exam Countdown */
T('exam-countdown', 'Exam Countdown', 'study', el => {
  el.innerHTML = `
    <label class="field"><span>Exam date &amp; time</span>
      <input type="datetime-local" class="inp" id="when">
    </label>
    <div class="result big" id="out">Set a date</div>
  `;
  const when = el.querySelector('#when'), out = el.querySelector('#out');
  when.addEventListener('change', () => {
    clearToolTimers();
    if (!when.value) { out.textContent = 'Set a date'; return; }
    const target = new Date(when.value).getTime();
    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) { out.textContent = '🎯 Time\'s up'; return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor(diff % 86400000 / 3600000);
      const m = Math.floor(diff % 3600000 / 60000);
      const s = Math.floor(diff % 60000 / 1000);
      out.textContent = `${d}d ${h}h ${m}m ${s}s`;
    }
    tick(); toolInterval(tick, 1000);
  });
});

/* 18. Study Timer (count up) */
T('study-timer', 'Study Timer', 'study', el => {
  el.innerHTML = `
    <div class="result big" id="out">00:00:00</div>
    <div class="row"><button class="btn" id="start">Start</button>
      <button class="btn-ghost" id="pause">Pause</button>
      <button class="btn-ghost" id="reset">Reset</button></div>
  `;
  const out = el.querySelector('#out');
  let secs = 0, running = false, id = null;
  function fmt() {
    const h = String(Math.floor(secs/3600)).padStart(2,'0');
    const m = String(Math.floor(secs%3600/60)).padStart(2,'0');
    const s = String(secs%60).padStart(2,'0');
    out.textContent = `${h}:${m}:${s}`;
  }
  el.querySelector('#start').onclick = () => {
    if (running) return; running = true;
    id = toolInterval(() => { secs++; fmt(); }, 1000);
  };
  el.querySelector('#pause').onclick = () => { running = false; if (id) clearInterval(id); };
  el.querySelector('#reset').onclick = () => { running = false; if (id) clearInterval(id); secs = 0; fmt(); };
});

/* 19. Pomodoro */
T('pomodoro', 'Pomodoro Timer', 'study', el => {
  el.innerHTML = `
    <div class="row"><select class="inp" id="mode" style="max-width:180px">
      <option value="25">Focus 25 min</option>
      <option value="50">Focus 50 min</option>
      <option value="5">Break 5 min</option>
      <option value="15">Break 15 min</option>
    </select></div>
    <div class="result big" id="out">25:00</div>
    <div class="row"><button class="btn" id="go">Start</button>
      <button class="btn-ghost" id="reset">Reset</button></div>
    <p class="tiny muted">Session ends with a beep. Timer clears when you navigate away.</p>
  `;
  const mode = el.querySelector('#mode'), out = el.querySelector('#out');
  let left = 25 * 60, id = null, running = false;
  function render() {
    const m = String(Math.floor(left/60)).padStart(2,'0');
    const s = String(left%60).padStart(2,'0');
    out.textContent = `${m}:${s}`;
  }
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + 1.2);
      o.start(); o.stop(ctx.currentTime + 1.2);
    } catch {}
  }
  function setMode() { left = parseInt(mode.value) * 60; render(); }
  el.querySelector('#go').onclick = () => {
    if (running) return; running = true;
    id = toolInterval(() => {
      left--; render();
      if (left <= 0) { clearInterval(id); running = false; beep(); toast('Session complete', 'success'); }
    }, 1000);
  };
  el.querySelector('#reset').onclick = () => { if (id) clearInterval(id); running = false; setMode(); };
  mode.addEventListener('change', () => { if (id) clearInterval(id); running = false; setMode(); });
  setMode();
});

/* 20. Study Planner */
T('study-planner', 'Daily Study Planner', 'study', el => {
  const KEY = 'planner';
  el.innerHTML = `
    <div class="field-row"><input class="inp" id="sub" placeholder="Subject / topic"><input type="time" class="inp" id="tm" style="flex:0 0 130px"></div>
    <div class="row"><button class="btn" id="add">Add block</button></div>
    <div class="list" id="list" style="margin-top:12px"></div>
  `;
  const sub = el.querySelector('#sub'), tm = el.querySelector('#tm'), list = el.querySelector('#list');
  function save(items) { LS.set(KEY, items); }
  function draw() {
    const items = LS.get(KEY, []).sort((a, b) => a.t.localeCompare(b.t));
    list.innerHTML = items.length ? items.map((it, i) => `
      <div class="list-item"><span class="grow"><strong>${esc(it.t)}</strong> -- ${esc(it.s)}</span>
        <button class="x" data-i="${i}">×</button></div>
    `).join('') : '<p class="muted tiny">No blocks yet.</p>';
    list.querySelectorAll('.x').forEach(b => b.onclick = () => {
      const arr = LS.get(KEY, []); arr.splice(+b.dataset.i, 1); save(arr); draw();
    });
  }
  el.querySelector('#add').onclick = () => {
    if (!sub.value.trim() || !tm.value) { toast('Enter subject and time', 'error'); return; }
    const arr = LS.get(KEY, []); arr.push({ s: sub.value.trim(), t: tm.value }); save(arr);
    sub.value = ''; draw();
  };
  draw();
});

/* 21. Revision Scheduler */
T('revision-sched', 'Revision Scheduler', 'study', el => {
  el.innerHTML = `
    <label class="field"><span>Exam date</span><input type="date" class="inp" id="d"></label>
    <label class="field"><span>Topic / subject</span><input class="inp" id="s" placeholder="e.g. Biology -- Chapter 5"></label>
    <button class="btn" id="run">Generate schedule</button>
    <div id="out" style="margin-top:14px"></div>
  `;
  el.querySelector('#run').onclick = () => {
    const d = el.querySelector('#d').value;
    const s = el.querySelector('#s').value.trim() || 'Topic';
    if (!d) { toast('Pick an exam date', 'error'); return; }
    const target = new Date(d + 'T00:00:00');
    const offsets = [1, 3, 7, 14, 21, 30];
    const out = el.querySelector('#out');
    const rows = offsets.map(n => {
      const date = new Date(target); date.setDate(date.getDate() - n);
      return `<div class="list-item"><span class="grow">${date.toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'})} -- review ${esc(s)}</span>
        <span class="tiny muted">T-${n}d</span></div>`;
    }).join('');
    out.innerHTML = `<h3 style="margin-bottom:8px">Spaced revision plan</h3><div class="list">${rows}</div>`;
  };
});

/* 22. Flashcard Creator */
T('flip-card', 'Flashcard Creator', 'study', el => {
  const KEY = 'flashcards';
  el.innerHTML = `
    <div class="field-row"><input class="inp" id="front" placeholder="Front (question)"><input class="inp" id="back" placeholder="Back (answer)"></div>
    <div class="row"><button class="btn" id="add">Add card</button>
      <button class="btn-ghost" id="next">Next card</button></div>
    <div class="flashcard" id="card" style="margin-top:14px">Add cards to begin.</div>
    <p class="tiny muted" id="counter"></p>
  `;
  let idx = 0, flipped = false;
  const card = el.querySelector('#card');
  function draw() {
    const arr = LS.get(KEY, []);
    el.querySelector('#counter').textContent = arr.length ? `${idx + 1} / ${arr.length}` : '';
    if (!arr.length) { card.textContent = 'Add cards to begin.'; return; }
    if (idx >= arr.length) idx = 0;
    card.textContent = flipped ? arr[idx].back : arr[idx].front;
  }
  el.querySelector('#add').onclick = () => {
    const f = el.querySelector('#front').value.trim(), b = el.querySelector('#back').value.trim();
    if (!f || !b) { toast('Fill both fields', 'error'); return; }
    const arr = LS.get(KEY, []); arr.push({ front: f, back: b }); LS.set(KEY, arr);
    el.querySelector('#front').value = ''; el.querySelector('#back').value = '';
    idx = arr.length - 1; flipped = false; draw();
  };
  el.querySelector('#next').onclick = () => {
    const arr = LS.get(KEY, []); if (!arr.length) return;
    idx = (idx + 1) % arr.length; flipped = false; draw();
  };
  card.onclick = () => { flipped = !flipped; draw(); };
  draw();
});

/* 23. Random Question Generator */
T('random-q', 'Random Question Generator', 'study', el => {
  el.innerHTML = `
    <textarea class="inp" id="qs" placeholder="Paste your question bank, one per line"></textarea>
    <button class="btn" id="pick">Pick a random question</button>
    <div class="result" id="out" style="margin-top:12px">--</div>
  `;
  el.querySelector('#pick').onclick = () => {
    const qs = el.querySelector('#qs').value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!qs.length) { el.querySelector('#out').textContent = 'Add questions first'; return; }
    el.querySelector('#out').textContent = qs[Math.floor(Math.random() * qs.length)];
  };
});

/* 24. Notes Manager */
T('notes', 'Study Notes Manager', 'study', el => {
  const KEY = 'notes';
  el.innerHTML = `
    <input class="inp" id="title" placeholder="Note title">
    <textarea class="inp" id="body" placeholder="Write your note…"></textarea>
    <div class="row"><button class="btn" id="save">Save note</button>
      <button class="btn-ghost" id="new">New</button></div>
    <div class="list" id="list" style="margin-top:14px"></div>
  `;
  const title = el.querySelector('#title'), body = el.querySelector('#body'), list = el.querySelector('#list');
  function draw() {
    const arr = LS.get(KEY, []);
    list.innerHTML = arr.length ? arr.map((n, i) => `
      <div class="list-item">
        <span class="grow"><strong>${esc(n.title || 'Untitled')}</strong><br><span class="sub">${esc(n.body.slice(0, 80))}${n.body.length > 80 ? '…' : ''}</span></span>
        <button class="x" data-open="${i}">open</button><button class="x" data-del="${i}">×</button>
      </div>`).join('') : '<p class="muted tiny">No notes yet.</p>';
    list.querySelectorAll('[data-open]').forEach(b => b.onclick = () => {
      const n = LS.get(KEY, [])[+b.dataset.open]; title.value = n.title; body.value = n.body;
    });
    list.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const arr = LS.get(KEY, []); arr.splice(+b.dataset.del, 1); LS.set(KEY, arr); draw();
    });
  }
  el.querySelector('#save').onclick = () => {
    if (!title.value.trim() && !body.value.trim()) { toast('Add a title or body', 'error'); return; }
    const arr = LS.get(KEY, []); arr.unshift({ title: title.value.trim(), body: body.value, ts: Date.now() });
    LS.set(KEY, arr); title.value = ''; body.value = ''; draw(); toast('Saved', 'success');
  };
  el.querySelector('#new').onclick = () => { title.value = ''; body.value = ''; };
  draw();
});

/* ============================================================
   C. WRITING (25–35)
   ============================================================ */
function textTool(id, name, counterFn) {
  T(id, name, 'writing', el => {
    el.innerHTML = `
      <textarea class="inp" id="t" placeholder="Paste text here…"></textarea>
      <div class="row"><button class="btn-ghost" id="copy">Copy</button>
        <button class="btn-ghost" id="clear">Clear</button></div>
      <div class="stats-inline" id="out"></div>
    `;
    const t = el.querySelector('#t'), out = el.querySelector('#out');
    function run() { out.innerHTML = counterFn(t.value); }
    t.addEventListener('input', run);
    el.querySelector('#copy').onclick = () => copyText(t.value);
    el.querySelector('#clear').onclick = () => { t.value = ''; run(); };
    run();
  });
}
textTool('word-counter', 'Word Counter', v => {
  const w = v.trim() ? v.trim().split(/\s+/).length : 0;
  return `<div class="stat"><span class="stat-v">${w}</span><span class="stat-l">Words</span></div>`;
});
textTool('char-counter', 'Character Counter', v => `
  <div class="stat"><span class="stat-v">${v.length}</span><span class="stat-l">Characters</span></div>
  <div class="stat"><span class="stat-v">${v.replace(/\s/g, '').length}</span><span class="stat-l">No spaces</span></div>
  <div class="stat"><span class="stat-v">${v.split(/\n/).length}</span><span class="stat-l">Lines</span></div>
`);
textTool('sentence-counter', 'Sentence Counter', v => {
  const s = v.split(/[.!?]+/).filter(x => x.trim()).length;
  return `<div class="stat"><span class="stat-v">${s}</span><span class="stat-l">Sentences</span></div>`;
});
textTool('para-counter', 'Paragraph Counter', v => {
  const p = v.split(/\n\s*\n/).filter(x => x.trim()).length;
  return `<div class="stat"><span class="stat-v">${p}</span><span class="stat-l">Paragraphs</span></div>`;
});

/* 29. Case Converter */
T('case-conv', 'Text Case Converter', 'writing', el => {
  el.innerHTML = `
    <textarea class="inp" id="t" placeholder="Paste text…"></textarea>
    <div class="row">
      <button class="btn-ghost" data-c="upper">UPPER</button>
      <button class="btn-ghost" data-c="lower">lower</button>
      <button class="btn-ghost" data-c="title">Title Case</button>
      <button class="btn-ghost" data-c="sentence">Sentence case</button>
      <button class="btn-ghost" data-c="toggle">tOGGLE</button>
      <button class="btn-ghost" data-c="snake">snake_case</button>
      <button class="btn-ghost" data-c="kebab">kebab-case</button>
      <button class="btn-ghost" data-c="camel">camelCase</button>
    </div>
    <div class="row"><button class="btn" id="copy">Copy</button></div>
  `;
  const t = el.querySelector('#t');
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    const v = t.value, c = b.dataset.c;
    let r = v;
    if (c === 'upper') r = v.toUpperCase();
    else if (c === 'lower') r = v.toLowerCase();
    else if (c === 'title') r = v.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
    else if (c === 'sentence') r = v.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, s => s.toUpperCase());
    else if (c === 'toggle') r = v.replace(/[a-zA-Z]/g, ch => ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase());
    else if (c === 'snake') r = v.trim().replace(/\s+/g, '_').toLowerCase();
    else if (c === 'kebab') r = v.trim().replace(/\s+/g, '-').toLowerCase();
    else if (c === 'camel') { const w = v.trim().split(/\s+/); r = w[0].toLowerCase() + w.slice(1).map(x => x[0].toUpperCase() + x.slice(1).toLowerCase()).join(''); }
    t.value = r;
  });
  el.querySelector('#copy').onclick = () => copyText(t.value);
});

/* 30. Remove Extra Spaces */
T('trim-spaces', 'Remove Extra Spaces', 'writing', el => {
  el.innerHTML = `
    <textarea class="inp" id="t" placeholder="Paste text…"></textarea>
    <div class="row">
      <button class="btn" data-a="spaces">Collapse spaces</button>
      <button class="btn-ghost" data-a="trim">Trim lines</button>
      <button class="btn-ghost" data-a="lines">Remove empty lines</button>
      <button class="btn-ghost" id="copy">Copy</button>
    </div>
  `;
  const t = el.querySelector('#t');
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'spaces') t.value = t.value.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n');
    if (b.dataset.a === 'trim') t.value = t.value.split('\n').map(l => l.trim()).join('\n');
    if (b.dataset.a === 'lines') t.value = t.value.split('\n').filter(l => l.trim()).join('\n');
  });
  el.querySelector('#copy').onclick = () => copyText(t.value);
});

/* 31. Text Reverser */
T('text-reverse', 'Text Reverser', 'writing', el => {
  el.innerHTML = `
    <textarea class="inp" id="t" placeholder="Paste text…"></textarea>
    <div class="row"><button class="btn" data-m="chars">Reverse characters</button>
      <button class="btn-ghost" data-m="words">Reverse words</button>
      <button class="btn-ghost" data-m="lines">Reverse lines</button>
      <button class="btn-ghost" id="copy">Copy</button></div>
  `;
  const t = el.querySelector('#t');
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    if (b.dataset.m === 'chars') t.value = [...t.value].reverse().join('');
    else if (b.dataset.m === 'words') t.value = t.value.split(/\b/).reverse().join('');
    else t.value = t.value.split('\n').reverse().join('\n');
  });
  el.querySelector('#copy').onclick = () => copyText(t.value);
});

/* 32. Alphabetical Sorter */
T('alpha-sort', 'Alphabetical Sorter', 'writing', el => {
  el.innerHTML = `
    <textarea class="inp" id="t" placeholder="One item per line…"></textarea>
    <div class="row"><button class="btn" data-dir="asc">A→Z</button>
      <button class="btn-ghost" data-dir="desc">Z→A</button>
      <button class="btn-ghost" data-dir="num">Numeric</button>
      <button class="btn-ghost" id="copy">Copy</button></div>
  `;
  const t = el.querySelector('#t');
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-dir]'); if (!b) return;
    const lines = t.value.split('\n');
    if (b.dataset.dir === 'asc') lines.sort((a, b) => a.localeCompare(b));
    else if (b.dataset.dir === 'desc') lines.sort((a, b) => b.localeCompare(a));
    else lines.sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0));
    t.value = lines.join('\n');
  });
  el.querySelector('#copy').onclick = () => copyText(t.value);
});

/* 33. Duplicate Line Remover */
T('dedupe-lines', 'Duplicate Line Remover', 'writing', el => {
  el.innerHTML = `
    <textarea class="inp" id="t" placeholder="One item per line…"></textarea>
    <div class="row"><button class="btn" id="run">Remove duplicates</button>
      <button class="btn-ghost" id="copy">Copy</button></div>
    <p class="tiny muted" id="info"></p>
  `;
  const t = el.querySelector('#t');
  el.querySelector('#run').onclick = () => {
    const lines = t.value.split('\n');
    const seen = new Set(); const out = [];
    for (const l of lines) { if (!seen.has(l)) { seen.add(l); out.push(l); } }
    el.querySelector('#info').textContent = `Removed ${lines.length - out.length} duplicate line(s).`;
    t.value = out.join('\n');
  };
  el.querySelector('#copy').onclick = () => copyText(t.value);
});

/* 34. Diff Checker */
T('diff-check', 'Text Diff Checker', 'writing', el => {
  el.innerHTML = `
    <div class="field-row" style="flex-direction:column;gap:8px">
      <textarea class="inp" id="a" placeholder="Original text"></textarea>
      <textarea class="inp" id="b" placeholder="New text"></textarea>
    </div>
    <button class="btn" id="run">Compare</button>
    <div id="out" style="margin-top:12px;font-family:ui-monospace,monospace;font-size:.85rem;white-space:pre-wrap"></div>
  `;
  el.querySelector('#run').onclick = () => {
    const A = el.querySelector('#a').value.split('\n');
    const B = el.querySelector('#b').value.split('\n');
    const m = A.length, n = B.length;
    const dp = Array.from({length: m+1}, () => new Array(n+1).fill(0));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      dp[i][j] = A[i-1] === B[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
    const out = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (A[i-1] === B[j-1]) { out.unshift(['same', A[i-1]]); i--; j--; }
      else if (dp[i-1][j] >= dp[i][j-1]) { out.unshift(['del', A[i-1]]); i--; }
      else { out.unshift(['add', B[j-1]]); j--; }
    }
    while (i > 0) { out.unshift(['del', A[i-1]]); i--; }
    while (j > 0) { out.unshift(['add', B[j-1]]); j--; }
    const html = out.map(([k, v]) => {
      const color = k === 'add' ? 'var(--success)' : k === 'del' ? 'var(--danger)' : 'inherit';
      const prefix = k === 'add' ? '+ ' : k === 'del' ? '− ' : '  ';
      return `<span style="color:${color}">${esc(prefix + v)}</span>`;
    }).join('\n');
    el.querySelector('#out').innerHTML = html;
  };
});

/* 35. Reading Time */
T('reading-time', 'Reading Time Calculator', 'writing', el => {
  el.innerHTML = `
    <textarea class="inp" id="t" placeholder="Paste text…"></textarea>
    <div class="row"><select class="inp" id="wpm" style="max-width:200px">
      <option value="200">Slow (200 wpm)</option>
      <option value="250" selected>Average (250 wpm)</option>
      <option value="300">Fast (300 wpm)</option>
    </select></div>
    <div class="stats-inline" id="out"></div>
  `;
  const t = el.querySelector('#t'), wpm = el.querySelector('#wpm'), out = el.querySelector('#out');
  function run() {
    const words = t.value.trim() ? t.value.trim().split(/\s+/).length : 0;
    const mins = words / parseInt(wpm.value);
    out.innerHTML = `
      <div class="stat"><span class="stat-v">${words}</span><span class="stat-l">Words</span></div>
      <div class="stat"><span class="stat-v">${mins < 1 ? '<1' : Math.ceil(mins)}</span><span class="stat-l">Minutes</span></div>
    `;
  }
  t.addEventListener('input', run); wpm.addEventListener('input', run); run();
});

/* ============================================================
   D. DAILY LIFE (36–48)
   ============================================================ */

/* 36. Digital Clock */
T('clock', 'Digital Clock', 'daily', el => {
  el.innerHTML = `
    <div class="result big" id="out" style="font-size:3rem;text-align:center;letter-spacing:-0.02em"></div>
    <div class="tiny muted" style="text-align:center" id="date"></div>
  `;
  const out = el.querySelector('#out'), date = el.querySelector('#date');
  function tick() {
    const d = new Date();
    out.textContent = d.toLocaleTimeString(undefined, { hour12: false });
    date.textContent = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  tick(); toolInterval(tick, 1000);
});

/* 37. Stopwatch */
T('stopwatch', 'Stopwatch', 'daily', el => {
  el.innerHTML = `
    <div class="result big" id="out" style="text-align:center;font-size:3rem">00:00.00</div>
    <div class="row" style="justify-content:center"><button class="btn" id="start">Start</button>
      <button class="btn-ghost" id="lap">Lap</button>
      <button class="btn-ghost" id="reset">Reset</button></div>
    <div class="list" id="laps" style="margin-top:12px"></div>
  `;
  const out = el.querySelector('#out'), lapsEl = el.querySelector('#laps');
  let start = 0, elapsed = 0, running = false, raf = null, laps = [];
  function fmt(ms) {
    const m = String(Math.floor(ms/60000)).padStart(2,'0');
    const s = String(Math.floor(ms%60000/1000)).padStart(2,'0');
    const cs = String(Math.floor(ms%1000/10)).padStart(2,'0');
    return `${m}:${s}.${cs}`;
  }
  function loop() {
    if (!running) return;
    out.textContent = fmt(elapsed + (Date.now() - start));
    raf = requestAnimationFrame(loop);
    if (toolTimers.indexOf('raf-swatch') === -1) toolTimers.push('raf-swatch');
  }
  el.querySelector('#start').onclick = () => {
    if (running) { running = false; elapsed += Date.now() - start; cancelAnimationFrame(raf); el.querySelector('#start').textContent = 'Start'; }
    else { running = true; start = Date.now(); loop(); el.querySelector('#start').textContent = 'Pause'; }
  };
  el.querySelector('#lap').onclick = () => {
    if (!running) return;
    laps.unshift(elapsed + (Date.now() - start));
    lapsEl.innerHTML = laps.map((t, i) => `<div class="list-item"><span class="grow">Lap ${laps.length - i}</span><span class="tiny muted">${fmt(t)}</span></div>`).join('');
  };
  el.querySelector('#reset').onclick = () => {
    running = false; cancelAnimationFrame(raf);
    elapsed = 0; out.textContent = '00:00.00'; laps = []; lapsEl.innerHTML = '';
    el.querySelector('#start').textContent = 'Start';
  };
});

/* 38. Countdown Timer */
T('countdown', 'Countdown Timer', 'daily', el => {
  el.innerHTML = `
    <div class="field-row">
      <input type="number" class="inp" id="m" placeholder="Minutes" value="5" min="0">
      <input type="number" class="inp" id="s" placeholder="Seconds" value="0" min="0" max="59">
    </div>
    <div class="result big" id="out" style="text-align:center;font-size:3rem">05:00</div>
    <div class="row" style="justify-content:center"><button class="btn" id="go">Start</button>
      <button class="btn-ghost" id="reset">Reset</button></div>
  `;
  const m = el.querySelector('#m'), s = el.querySelector('#s'), out = el.querySelector('#out');
  let total = 300, left = 300, id = null, running = false;
  function render() {
    const mm = String(Math.floor(left/60)).padStart(2,'0');
    const ss = String(left%60).padStart(2,'0');
    out.textContent = `${mm}:${ss}`;
  }
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + 1.4);
      o.start(); o.stop(ctx.currentTime + 1.4);
    } catch {}
  }
  el.querySelector('#go').onclick = () => {
    if (running) return;
    total = (parseInt(m.value) || 0) * 60 + (parseInt(s.value) || 0);
    if (left <= 0 || left === total) left = total;
    if (left <= 0) { toast('Set a duration', 'error'); return; }
    running = true;
    id = toolInterval(() => {
      left--; render();
      if (left <= 0) { clearInterval(id); running = false; beep(); toast('Time up', 'success'); }
    }, 1000);
  };
  el.querySelector('#reset').onclick = () => { clearInterval(id); running = false; left = total; render(); };
  render();
});

/* 39. Alarm Clock */
T('alarm', 'Alarm Clock', 'daily', el => {
  el.innerHTML = `
    <label class="field"><span>Alarm time</span><input type="time" class="inp" id="when"></label>
    <button class="btn" id="set">Set alarm</button>
    <p class="tiny muted" id="status">No alarm set. Keep this tab open.</p>
  `;
  const when = el.querySelector('#when'), status = el.querySelector('#status');
  let target = null, fired = false;
  el.querySelector('#set').onclick = () => {
    if (!when.value) { toast('Pick a time', 'error'); return; }
    const [h, m] = when.value.split(':').map(Number);
    target = new Date(); target.setHours(h, m, 0, 0);
    if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
    fired = false;
    status.textContent = `Alarm set for ${target.toLocaleString()}`;
  };
  toolInterval(() => {
    if (!target || fired) return;
    if (Date.now() >= target.getTime()) {
      fired = true;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 660; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(.3, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + 2);
        o.start(); o.stop(ctx.currentTime + 2);
      } catch {}
      toast('⏰ Alarm!', 'success');
      status.textContent = 'Alarm rang. Set another to repeat.';
    }
  }, 1000);
});

/* 40. Calendar */
T('calendar', 'Calendar', 'daily', el => {
  el.innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <button class="btn-ghost" id="prev">←</button>
      <strong id="label"></strong>
      <button class="btn-ghost" id="next">→</button>
    </div>
    <div class="cal-grid" id="grid"></div>
  `;
  let cur = new Date(); cur.setDate(1);
  const label = el.querySelector('#label'), grid = el.querySelector('#grid');
  function draw() {
    label.textContent = cur.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const y = cur.getFullYear(), m = cur.getMonth();
    const first = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = new Date();
    let html = ['S','M','T','W','T','F','S'].map(d => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < first; i++) html += `<div class="cal-cell mute"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
      html += `<div class="cal-cell ${isToday ? 'today' : ''}" data-d="${d}">${d}</div>`;
    }
    grid.innerHTML = html;
  }
  el.querySelector('#prev').onclick = () => { cur.setMonth(cur.getMonth() - 1); draw(); };
  el.querySelector('#next').onclick = () => { cur.setMonth(cur.getMonth() + 1); draw(); };
  draw();
});

/* 41. Age Calculator */
T('age-calc', 'Age Calculator', 'daily', el => {
  el.innerHTML = `
    <label class="field"><span>Date of birth</span><input type="date" class="inp" id="dob"></label>
    <div class="stats-inline" id="out"></div>
  `;
  const dob = el.querySelector('#dob'), out = el.querySelector('#out');
  dob.addEventListener('change', () => {
    if (!dob.value) { out.innerHTML = ''; return; }
    const b = new Date(dob.value + 'T00:00:00'), n = new Date();
    if (b > n) { out.innerHTML = '<div class="result error">Date is in the future</div>'; return; }
    let y = n.getFullYear() - b.getFullYear();
    let m = n.getMonth() - b.getMonth();
    let d = n.getDate() - b.getDate();
    if (d < 0) { m--; d += new Date(n.getFullYear(), n.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    const days = Math.floor((n - b) / 86400000);
    out.innerHTML = `
      <div class="stat"><span class="stat-v">${y}</span><span class="stat-l">Years</span></div>
      <div class="stat"><span class="stat-v">${m}</span><span class="stat-l">Months</span></div>
      <div class="stat"><span class="stat-v">${d}</span><span class="stat-l">Days</span></div>
      <div class="stat"><span class="stat-v">${fmtNum(days, 0)}</span><span class="stat-l">Total days</span></div>
    `;
  });
});

/* 42. Date Difference */
T('date-diff', 'Date Difference Calculator', 'daily', el => {
  el.innerHTML = `
    <div class="field-row"><input type="date" class="inp" id="a"><input type="date" class="inp" id="b"></div>
    <div class="stats-inline" id="out"></div>
  `;
  const a = el.querySelector('#a'), b = el.querySelector('#b'), out = el.querySelector('#out');
  function run() {
    if (!a.value || !b.value) { out.innerHTML = ''; return; }
    const d1 = new Date(a.value), d2 = new Date(b.value);
    const ms = Math.abs(d2 - d1);
    const days = Math.floor(ms / 86400000);
    out.innerHTML = `
      <div class="stat"><span class="stat-v">${days}</span><span class="stat-l">Days</span></div>
      <div class="stat"><span class="stat-v">${Math.floor(days/7)}</span><span class="stat-l">Weeks</span></div>
      <div class="stat"><span class="stat-v">${(days/30.44).toFixed(1)}</span><span class="stat-l">Months</span></div>
      <div class="stat"><span class="stat-v">${(days/365.25).toFixed(2)}</span><span class="stat-l">Years</span></div>
    `;
  }
  a.addEventListener('change', run); b.addEventListener('change', run);
});

/* 43. Days Between Dates */
T('days-between', 'Days Between Dates', 'daily', el => {
  el.innerHTML = `
    <div class="field-row"><input type="date" class="inp" id="a"><input type="date" class="inp" id="b"></div>
    <div class="result big" id="out">--</div>
  `;
  const a = el.querySelector('#a'), b = el.querySelector('#b'), out = el.querySelector('#out');
  function run() {
    if (!a.value || !b.value) { out.textContent = '--'; return; }
    const d = Math.abs((new Date(b.value) - new Date(a.value)) / 86400000);
    out.textContent = d + ' day' + (d === 1 ? '' : 's');
  }
  a.addEventListener('change', run); b.addEventListener('change', run);
});

/* 44. Password Generator */
T('password-gen', 'Password Generator', 'daily', el => {
  el.innerHTML = `
    <label class="field"><span>Length: <strong id="lenv">16</strong></span>
      <input type="range" class="inp" id="len" min="6" max="64" value="16" style="padding:0"></label>
    <div class="row">
      <label class="tiny"><input type="checkbox" id="lo" checked> a–z</label>
      <label class="tiny"><input type="checkbox" id="up" checked> A–Z</label>
      <label class="tiny"><input type="checkbox" id="dig" checked> 0–9</label>
      <label class="tiny"><input type="checkbox" id="sym" checked> symbols</label>
    </div>
    <button class="btn" id="gen">Generate</button>
    <div class="result big" id="out" style="word-break:break-all;font-family:ui-monospace,monospace"></div>
    <div class="row"><button class="btn-ghost" id="copy">Copy</button></div>
  `;
  const len = el.querySelector('#len'), lenv = el.querySelector('#lenv'), out = el.querySelector('#out');
  function gen() {
    const sets = [];
    if (el.querySelector('#lo').checked) sets.push('abcdefghijklmnopqrstuvwxyz');
    if (el.querySelector('#up').checked) sets.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    if (el.querySelector('#dig').checked) sets.push('0123456789');
    if (el.querySelector('#sym').checked) sets.push('!@#$%^&*()-_=+[]{};:,.<>/?');
    if (!sets.length) { out.textContent = 'Pick at least one character set'; return; }
    const all = sets.join('');
    const n = parseInt(len.value);
    const arr = new Uint32Array(n);
    crypto.getRandomValues(arr);
    let p = '';
    for (let i = 0; i < n; i++) p += all[arr[i] % all.length];
    out.textContent = p;
  }
  len.addEventListener('input', () => { lenv.textContent = len.value; gen(); });
  el.querySelector('#gen').onclick = gen;
  el.querySelector('#copy').onclick = () => copyText(out.textContent);
  gen();
});

/* 45. QR Code Generator */
T('qr-gen', 'QR Code Generator', 'daily', el => {
  el.innerHTML = `
    <input class="inp" id="txt" placeholder="Text or URL" value="https://example.com">
    <button class="btn" id="gen">Generate</button>
    <div id="out" style="display:flex;justify-content:center;padding:20px"></div>
    <p class="tiny muted">QR library loads on demand from cdn.jsdelivr.net. Requires internet for this tool only.</p>
  `;
  el.querySelector('#gen').onclick = async () => {
    const txt = el.querySelector('#txt').value.trim();
    if (!txt) { toast('Enter text', 'error'); return; }
    const out = el.querySelector('#out');
    out.innerHTML = '<p class="muted tiny">Loading QR engine…</p>';
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js');
      out.innerHTML = '';
      new window.QRCode(out, { text: txt, width: 220, height: 220, colorDark: '#000', colorLight: '#fff' });
    } catch {
      out.innerHTML = '<p class="result error">Could not load QR library (offline?)</p>';
    }
  };
});

/* 46. Color Picker */
T('color-picker', 'Color Picker', 'daily', el => {
  el.innerHTML = `
    <input type="color" id="c" value="#6c5b9e" style="width:100%;height:80px;border:1px solid var(--border);border-radius:8px;background:transparent;cursor:pointer">
    <div class="stats-inline" id="out"></div>
  `;
  const c = el.querySelector('#c'), out = el.querySelector('#out');
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n>>16)&255, (n>>8)&255, n&255]; }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
    let h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
  }
  function run() {
    const hex = c.value, [r, g, b] = hexToRgb(hex), [h, s, l] = rgbToHsl(r, g, b);
    out.innerHTML = `
      <div class="stat"><span class="stat-v">${hex}</span><span class="stat-l">HEX</span></div>
      <div class="stat"><span class="stat-v" style="font-size:.95rem">rgb(${r}, ${g}, ${b})</span><span class="stat-l">RGB</span></div>
      <div class="stat"><span class="stat-v" style="font-size:.95rem">hsl(${h}, ${s}%, ${l}%)</span><span class="stat-l">HSL</span></div>
    `;
  }
  c.addEventListener('input', run); run();
});

/* 47. Random Number Generator */
T('random-num', 'Random Number Generator', 'daily', el => {
  el.innerHTML = `
    <div class="field-row"><input type="number" class="inp" id="a" value="1"><input type="number" class="inp" id="b" value="100"></div>
    <button class="btn" id="gen">Generate</button>
    <div class="result big" id="out" style="text-align:center">--</div>
  `;
  el.querySelector('#gen').onclick = () => {
    const a = parseInt(el.querySelector('#a').value), b = parseInt(el.querySelector('#b').value);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) { toast('Check your range', 'error'); return; }
    el.querySelector('#out').textContent = Math.floor(Math.random() * (b - a + 1)) + a;
  };
});

/* 48. Random Choice Picker */
T('random-choice', 'Random Choice Picker', 'daily', el => {
  el.innerHTML = `
    <textarea class="inp" id="t" placeholder="One option per line"></textarea>
    <button class="btn" id="pick">Pick one</button>
    <div class="result big" id="out" style="text-align:center">--</div>
  `;
  el.querySelector('#pick').onclick = () => {
    const items = el.querySelector('#t').value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!items.length) { toast('Enter options', 'error'); return; }
    el.querySelector('#out').textContent = items[Math.floor(Math.random() * items.length)];
  };
});

/* ============================================================
   E. FILES (49–60)
   ============================================================ */

/* Drop-zone helper */
function makeDrop(el, onFile, accept = '') {
  el.innerHTML = `
    <div class="drop-zone" id="dz">
      <div>Drop file here or click to choose</div>
      <div class="tiny" style="margin-top:4px">${accept}</div>
      <input type="file" hidden id="fi" accept="${accept}">
    </div>
    <div id="file-info" class="tiny muted" style="margin-top:8px"></div>
  `;
  const dz = el.querySelector('#dz'), fi = el.querySelector('#fi');
  dz.addEventListener('click', () => fi.click());
  fi.addEventListener('change', () => fi.files[0] && onFile(fi.files[0]));
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('hover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('hover'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('hover');
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  });
  return { setInfo(txt) { el.querySelector('#file-info').textContent = txt; } };
}

/* 49. Image Resizer */
T('image-resize', 'Image Resizer', 'files', el => {
  el.innerHTML = `
    <div id="dz-host"></div>
    <div class="field-row" style="margin-top:12px">
      <input type="number" class="inp" id="w" placeholder="Width (px)">
      <input type="number" class="inp" id="h" placeholder="Height (px)">
    </div>
    <button class="btn" id="run" disabled>Resize &amp; download</button>
    <div style="margin-top:12px"><canvas id="cv" style="max-width:100%;display:none"></canvas></div>
  `;
  let img = null;
  const dz = makeDrop(el.querySelector('#dz-host'), f => {
    if (!f.type.startsWith('image/')) { toast('Choose an image', 'error'); return; }
    const url = URL.createObjectURL(f);
    img = new Image();
    img.onload = () => {
      el.querySelector('#w').value = img.width;
      el.querySelector('#h').value = img.height;
      dz.setInfo(`${f.name} -- ${img.width}×${img.height}, ${(f.size/1024).toFixed(1)} KB`);
      el.querySelector('#run').disabled = false;
    };
    img.src = url;
  }, 'image/*');
  el.querySelector('#run').onclick = () => {
    if (!img) return;
    const w = parseInt(el.querySelector('#w').value) || img.width;
    const h = parseInt(el.querySelector('#h').value) || img.height;
    const cv = el.querySelector('#cv');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    cv.toBlob(b => { downloadBlob(b, 'resized.png'); toast('Downloaded', 'success'); }, 'image/png');
  };
});

/* 50. Image Format Converter */
T('image-convert', 'Image Format Converter', 'files', el => {
  el.innerHTML = `
    <div id="dz-host"></div>
    <div class="row" style="margin-top:12px">
      <select class="inp" id="fmt" style="max-width:150px">
        <option value="image/png">PNG</option>
        <option value="image/jpeg">JPEG</option>
        <option value="image/webp">WebP</option>
      </select>
      <button class="btn" id="run" disabled>Convert &amp; download</button>
    </div>
  `;
  let img = null;
  const dz = makeDrop(el.querySelector('#dz-host'), f => {
    if (!f.type.startsWith('image/')) { toast('Choose an image', 'error'); return; }
    const url = URL.createObjectURL(f);
    img = new Image();
    img.onload = () => {
      dz.setInfo(`${f.name} -- ${(f.size/1024).toFixed(1)} KB`);
      el.querySelector('#run').disabled = false;
    };
    img.src = url;
  }, 'image/*');
  el.querySelector('#run').onclick = () => {
    if (!img) return;
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    cv.getContext('2d').drawImage(img, 0, 0);
    const fmt = el.querySelector('#fmt').value;
    const ext = fmt.split('/')[1].replace('jpeg', 'jpg');
    cv.toBlob(b => { downloadBlob(b, 'converted.' + ext); toast('Downloaded', 'success'); }, fmt, 0.92);
  };
});

/* 51. Image Compressor */
T('image-compress', 'Image Compressor', 'files', el => {
  el.innerHTML = `
    <div id="dz-host"></div>
    <label class="field"><span>Quality: <strong id="qv">0.75</strong></span>
      <input type="range" class="inp" id="q" min="0.1" max="1" step="0.05" value="0.75" style="padding:0"></label>
    <button class="btn" id="run" disabled>Compress &amp; download</button>
  `;
  let img = null;
  const q = el.querySelector('#q'), qv = el.querySelector('#qv');
  q.addEventListener('input', () => qv.textContent = q.value);
  const dz = makeDrop(el.querySelector('#dz-host'), f => {
    if (!f.type.startsWith('image/')) { toast('Choose an image', 'error'); return; }
    const url = URL.createObjectURL(f);
    img = new Image();
    img.onload = () => { dz.setInfo(`${f.name} -- ${(f.size/1024).toFixed(1)} KB original`); el.querySelector('#run').disabled = false; };
    img.src = url;
  }, 'image/*');
  el.querySelector('#run').onclick = () => {
    if (!img) return;
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    cv.getContext('2d').drawImage(img, 0, 0);
    cv.toBlob(b => {
      downloadBlob(b, 'compressed.jpg');
      dz.setInfo(`Compressed to ${(b.size/1024).toFixed(1)} KB`);
      toast('Downloaded', 'success');
    }, 'image/jpeg', parseFloat(q.value));
  };
});

/* 52. PDF Merger */
T('pdf-merge', 'PDF Merger', 'files', el => {
  el.innerHTML = `
    <input type="file" class="inp" id="fs" accept="application/pdf" multiple>
    <div id="info" class="tiny muted" style="margin-top:8px"></div>
    <button class="btn" id="run" disabled style="margin-top:12px">Merge &amp; download</button>
    <p class="tiny muted">Uses pdf-lib from unpkg. Requires internet on first use.</p>
  `;
  const fs = el.querySelector('#fs'), info = el.querySelector('#info'), run = el.querySelector('#run');
  fs.addEventListener('change', () => {
    if (!fs.files.length) return;
    info.textContent = [...fs.files].map(f => `${f.name} (${(f.size/1024).toFixed(0)} KB)`).join(' · ');
    run.disabled = fs.files.length < 2;
  });
  run.onclick = async () => {
    try {
      await loadScript('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js');
      const { PDFDocument } = window.PDFLib;
      const merged = await PDFDocument.create();
      for (const f of fs.files) {
        const bytes = await f.arrayBuffer();
        const src = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      const bytes = await merged.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf');
      toast('Merged', 'success');
    } catch (e) { toast('Merge failed: ' + e.message, 'error'); }
  };
});

/* 53. PDF Splitter */
T('pdf-split', 'PDF Splitter', 'files', el => {
  el.innerHTML = `
    <input type="file" class="inp" id="f" accept="application/pdf">
    <div class="field-row" style="margin-top:10px">
      <input type="number" class="inp" id="from" placeholder="From page" min="1" value="1">
      <input type="number" class="inp" id="to" placeholder="To page" min="1">
    </div>
    <button class="btn" id="run" disabled>Extract &amp; download</button>
  `;
  const f = el.querySelector('#f'), run = el.querySelector('#run');
  f.addEventListener('change', () => { run.disabled = !f.files[0]; });
  run.onclick = async () => {
    try {
      await loadScript('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js');
      const { PDFDocument } = window.PDFLib;
      const src = await PDFDocument.load(await f.files[0].arrayBuffer());
      const total = src.getPageCount();
      const from = Math.max(1, parseInt(el.querySelector('#from').value) || 1) - 1;
      const to = Math.min(total, parseInt(el.querySelector('#to').value) || total) - 1;
      if (to < from) { toast('Invalid range', 'error'); return; }
      const out = await PDFDocument.create();
      const idx = []; for (let i = from; i <= to; i++) idx.push(i);
      const pages = await out.copyPages(src, idx);
      pages.forEach(p => out.addPage(p));
      const bytes = await out.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `split_${from+1}-${to+1}.pdf`);
      toast('Extracted', 'success');
    } catch (e) { toast('Split failed: ' + e.message, 'error'); }
  };
});

/* 54. PDF Page Counter */
T('pdf-count', 'PDF Page Counter', 'files', el => {
  el.innerHTML = `
    <input type="file" class="inp" id="f" accept="application/pdf">
    <div class="result big" id="out" style="margin-top:12px">--</div>
  `;
  const f = el.querySelector('#f'), out = el.querySelector('#out');
  f.addEventListener('change', async () => {
    if (!f.files[0]) return;
    out.textContent = 'Loading…';
    try {
      await loadScript('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js');
      const { PDFDocument } = window.PDFLib;
      const doc = await PDFDocument.load(await f.files[0].arrayBuffer());
      out.textContent = doc.getPageCount() + ' pages';
    } catch (e) { out.textContent = 'Failed: ' + e.message; out.classList.add('error'); }
  });
});

/* 55. File Size Converter */
T('filesize-conv', 'File Size Converter', 'files', unitConverter({
  'Byte': 1, 'Kilobyte (KB)': 1024, 'Megabyte (MB)': 1024**2,
  'Gigabyte (GB)': 1024**3, 'Terabyte (TB)': 1024**4
}));

/* 56. JSON Formatter */
T('json-fmt', 'JSON Formatter', 'files', el => {
  el.innerHTML = `
    <textarea class="inp" id="t" placeholder='{"hello":"world"}'></textarea>
    <div class="row">
      <button class="btn" data-a="pretty">Pretty</button>
      <button class="btn-ghost" data-a="min">Minify</button>
      <button class="btn-ghost" id="copy">Copy</button>
    </div>
    <div class="result error" id="err" style="display:none"></div>
  `;
  const t = el.querySelector('#t'), err = el.querySelector('#err');
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    err.style.display = 'none';
    try {
      const obj = JSON.parse(t.value);
      t.value = b.dataset.a === 'pretty' ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
    } catch (ex) { err.textContent = 'Invalid JSON: ' + ex.message; err.style.display = 'block'; }
  });
  el.querySelector('#copy').onclick = () => copyText(t.value);
});

/* 57. Base64 */
T('base64', 'Base64 Encoder / Decoder', 'files', el => {
  el.innerHTML = `
    <textarea class="inp" id="t" placeholder="Text or Base64…"></textarea>
    <div class="row">
      <button class="btn" data-a="enc">Encode</button>
      <button class="btn-ghost" data-a="dec">Decode</button>
      <button class="btn-ghost" id="copy">Copy</button>
    </div>
  `;
  const t = el.querySelector('#t');
  function enc(s) { return btoa(unescape(encodeURIComponent(s))); }
  function dec(s) { return decodeURIComponent(escape(atob(s))); }
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    try { t.value = b.dataset.a === 'enc' ? enc(t.value) : dec(t.value); }
    catch { toast('Invalid input', 'error'); }
  });
  el.querySelector('#copy').onclick = () => copyText(t.value);
});

/* 58. CSV Viewer */
T('csv-view', 'CSV Viewer', 'files', el => {
  el.innerHTML = `
    <textarea class="inp" id="t" placeholder="name,age,city&#10;Alice,22,London"></textarea>
    <button class="btn" id="run">Parse</button>
    <div id="out" style="overflow-x:auto;margin-top:12px"></div>
  `;
  el.querySelector('#run').onclick = () => {
    const text = el.querySelector('#t').value.trim();
    if (!text) { toast('Paste CSV first', 'error'); return; }
    const rows = text.split('\n').map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
    const out = el.querySelector('#out');
    out.innerHTML = `<table class="tt" style="width:100%;border-collapse:collapse">
      <thead><tr>${rows[0].map(c => `<th style="border:1px solid var(--border);padding:6px;background:var(--surface-2)">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${rows.slice(1).map(r => `<tr>${r.map(c => `<td style="border:1px solid var(--border);padding:6px">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
  };
});

/* 59. Text File Viewer */
T('txt-view', 'Text File Viewer', 'files', el => {
  el.innerHTML = `
    <input type="file" class="inp" id="f" accept=".txt,.md,.log,.csv,text/*">
    <div class="tiny muted" id="meta" style="margin-top:6px"></div>
    <textarea class="inp" id="out" readonly style="margin-top:10px" rows="16"></textarea>
  `;
  el.querySelector('#f').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    const text = await readFile(f, 'text');
    el.querySelector('#meta').textContent = `${f.name} -- ${(f.size/1024).toFixed(1)} KB`;
    el.querySelector('#out').value = text;
  });
});

/* 60. Markdown Previewer */
function mdInline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}
function mdParse(md) {
  let html = '';
  const lines = md.split('\n');
  let inCode = false, buf = [], inUl = false, inOl = false;
  const closeLists = () => { if (inUl) { html += '</ul>'; inUl = false; } if (inOl) { html += '</ol>'; inOl = false; } };
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) { html += '<pre><code>' + esc(buf.join('\n')) + '</code></pre>'; inCode = false; buf = []; }
      else { closeLists(); inCode = true; }
      continue;
    }
    if (inCode) { buf.push(line); continue; }
    let m;
    if (m = line.match(/^(#{1,6})\s+(.*)$/)) { closeLists(); const n = m[1].length; html += `<h${n}>${mdInline(m[2])}</h${n}>`; continue; }
    if (!line.trim()) { closeLists(); continue; }
    if (m = line.match(/^[-*]\s+(.*)$/)) { if (!inUl) { closeLists(); html += '<ul>'; inUl = true; } html += `<li>${mdInline(m[1])}</li>`; continue; }
    if (m = line.match(/^\d+\.\s+(.*)$/)) { if (!inOl) { closeLists(); html += '<ol>'; inOl = true; } html += `<li>${mdInline(m[1])}</li>`; continue; }
    closeLists();
    html += `<p>${mdInline(line)}</p>`;
  }
  closeLists();
  if (inCode) html += '<pre><code>' + esc(buf.join('\n')) + '</code></pre>';
  return html;
}
T('md-preview', 'Markdown Previewer', 'files', el => {
  el.innerHTML = `
    <textarea class="inp" id="t" rows="10" placeholder="# Hello&#10;&#10;**Bold** and *italic*&#10;&#10;- item one&#10;- item two"></textarea>
    <div class="result" id="out" style="min-height:120px;line-height:1.6"></div>
  `;
  const t = el.querySelector('#t'), out = el.querySelector('#out');
  t.addEventListener('input', () => { out.innerHTML = mdParse(t.value); });
});

/* ============================================================
   F. PRODUCTIVITY (61–70)
   ============================================================ */

function todayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate(); }

/* 61. To-Do List */
T('to-do', 'To-Do List', 'prod', el => {
  const KEY = 'todo';
  el.innerHTML = `
    <div class="field-row"><input class="inp" id="t" placeholder="What needs doing?"><button class="btn" id="add">Add</button></div>
    <div class="list" id="list" style="margin-top:12px"></div>
  `;
  const input = el.querySelector('#t'), list = el.querySelector('#list');
  function draw() {
    const arr = LS.get(KEY, []);
    list.innerHTML = arr.length ? arr.map((t, i) => `
      <div class="list-item ${t.done ? 'done' : ''}">
        <input type="checkbox" class="checkbox" ${t.done ? 'checked' : ''} data-i="${i}">
        <span class="grow">${esc(t.text)}</span>
        <button class="x" data-del="${i}">×</button>
      </div>`).join('') : '<p class="muted tiny">Nothing yet. Add your first task.</p>';
  }
  el.querySelector('#add').onclick = () => {
    const v = input.value.trim(); if (!v) return;
    const arr = LS.get(KEY, []); arr.push({ text: v, done: false }); LS.set(KEY, arr);
    input.value = ''; draw();
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') el.querySelector('#add').click(); });
  list.addEventListener('click', e => {
    const cb = e.target.closest('.checkbox');
    if (cb) { const arr = LS.get(KEY, []); arr[+cb.dataset.i].done = cb.checked; LS.set(KEY, arr); draw(); }
    const x = e.target.closest('[data-del]');
    if (x) { const arr = LS.get(KEY, []); arr.splice(+x.dataset.del, 1); LS.set(KEY, arr); draw(); }
  });
  draw();
});

/* 62. Habit Tracker */
T('habits', 'Daily Habit Tracker', 'prod', el => {
  const KEY = 'habits';
  el.innerHTML = `
    <div class="field-row"><input class="inp" id="name" placeholder="New habit (e.g. Read 20 min)"><button class="btn" id="add">Add</button></div>
    <div id="grid" style="margin-top:14px;overflow-x:auto"></div>
  `;
  function draw() {
    const arr = LS.get(KEY, []);
    const grid = el.querySelector('#grid');
    if (!arr.length) { grid.innerHTML = '<p class="muted tiny">Add a habit to start tracking.</p>'; return; }
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
    const today = new Date();
    grid.innerHTML = `
      <table class="tt" style="border-collapse:collapse;width:100%;min-width:400px">
        <thead><tr><th style="border:1px solid var(--border);padding:6px;background:var(--surface-2);text-align:left">Habit</th>
          ${days.map(d => `<th style="border:1px solid var(--border);padding:6px;background:var(--surface-2);font-size:.72rem">${d.toLocaleDateString(undefined,{weekday:'short'})}</th>`).join('')}
          <th></th></tr></thead>
        <tbody>${arr.map((h, i) => `<tr>
          <td style="border:1px solid var(--border);padding:6px">${esc(h.name)}</td>
          ${days.map(d => {
            const k = d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
            const on = h.log?.[k];
            return `<td style="border:1px solid var(--border);padding:6px;text-align:center">
              <input type="checkbox" class="checkbox" ${on ? 'checked' : ''} data-h="${i}" data-d="${k}">
            </td>`;
          }).join('')}
          <td style="border:1px solid var(--border);padding:6px;text-align:center"><button class="x" data-del="${i}">×</button></td>
        </tr>`).join('')}</tbody>
      </table>`;
    grid.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        const arr = LS.get(KEY, []);
        arr[+cb.dataset.h].log = arr[+cb.dataset.h].log || {};
        arr[+cb.dataset.h].log[cb.dataset.d] = cb.checked;
        LS.set(KEY, arr);
      });
    });
    grid.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const arr = LS.get(KEY, []); arr.splice(+b.dataset.del, 1); LS.set(KEY, arr); draw();
    });
  }
  el.querySelector('#add').onclick = () => {
    const v = el.querySelector('#name').value.trim(); if (!v) return;
    const arr = LS.get(KEY, []); arr.push({ name: v, log: {} }); LS.set(KEY, arr);
    el.querySelector('#name').value = ''; draw();
  };
  draw();
});

/* 63. Expense Tracker */
T('expenses', 'Expense Tracker', 'prod', el => {
  const KEY = 'expenses';
  el.innerHTML = `
    <div class="field-row"><input class="inp" id="d" placeholder="Description"><input type="number" class="inp" id="a" placeholder="Amount" step="0.01" style="flex:0 0 130px"></div>
    <div class="row"><button class="btn" id="add">Add expense</button></div>
    <div class="result big" id="total" style="margin-top:12px">Total: 0</div>
    <div class="list" id="list" style="margin-top:10px"></div>
  `;
  function draw() {
    const arr = LS.get(KEY, []);
    const total = arr.reduce((s, x) => s + x.amount, 0);
    el.querySelector('#total').textContent = 'Total: ' + fmtNum(total, 2);
    el.querySelector('#list').innerHTML = arr.length ? arr.map((x, i) => `
      <div class="list-item"><span class="grow">${esc(x.desc)}</span>
        <strong>${fmtNum(x.amount, 2)}</strong>
        <button class="x" data-del="${i}">×</button></div>`).join('') : '<p class="muted tiny">No expenses yet.</p>';
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const arr2 = LS.get(KEY, []); arr2.splice(+b.dataset.del, 1); LS.set(KEY, arr2); draw();
    });
  }
  el.querySelector('#add').onclick = () => {
    const desc = el.querySelector('#d').value.trim(), amt = parseFloat(el.querySelector('#a').value);
    if (!desc || !isFinite(amt)) { toast('Fill both fields', 'error'); return; }
    const arr = LS.get(KEY, []); arr.unshift({ desc, amount: amt }); LS.set(KEY, arr);
    el.querySelector('#d').value = ''; el.querySelector('#a').value = ''; draw();
  };
  draw();
});

/* 64. Personal Diary */
T('diary', 'Personal Diary', 'prod', el => {
  const KEY = 'diary';
  el.innerHTML = `
    <input type="date" class="inp" id="d">
    <textarea class="inp" id="t" rows="6" placeholder="Write freely…"></textarea>
    <button class="btn" id="save">Save entry</button>
    <div class="list" id="list" style="margin-top:12px"></div>
  `;
  const dInp = el.querySelector('#d'), tInp = el.querySelector('#t'), list = el.querySelector('#list');
  dInp.value = new Date().toISOString().slice(0, 10);
  function draw() {
    const arr = LS.get(KEY, []);
    list.innerHTML = arr.length ? arr.map((x, i) => `
      <div class="list-item"><span class="grow"><strong>${esc(x.date)}</strong><br><span class="sub">${esc(x.text.slice(0, 100))}${x.text.length > 100 ? '…' : ''}</span></span>
      <button class="x" data-open="${i}">open</button><button class="x" data-del="${i}">×</button></div>`).join('') : '<p class="muted tiny">No entries yet.</p>';
    list.querySelectorAll('[data-open]').forEach(b => b.onclick = () => {
      const e = LS.get(KEY, [])[+b.dataset.open]; dInp.value = e.date; tInp.value = e.text;
    });
    list.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const arr2 = LS.get(KEY, []); arr2.splice(+b.dataset.del, 1); LS.set(KEY, arr2); draw();
    });
  }
  el.querySelector('#save').onclick = () => {
    if (!tInp.value.trim()) return;
    const arr = LS.get(KEY, []);
    arr.unshift({ date: dInp.value, text: tInp.value });
    LS.set(KEY, arr); tInp.value = ''; draw(); toast('Saved', 'success');
  };
  draw();
});

/* 65. Quick Notes */
T('quick-notes', 'Quick Notes', 'prod', el => {
  const KEY = 'quicknote';
  el.innerHTML = `
    <textarea class="inp" id="t" rows="14" placeholder="Autosaved as you type…"></textarea>
    <p class="tiny muted" id="status">Autosaves locally.</p>
  `;
  const t = el.querySelector('#t');
  t.value = LS.get(KEY, '');
  let timeout;
  t.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => { LS.set(KEY, t.value); el.querySelector('#status').textContent = 'Saved at ' + new Date().toLocaleTimeString(); }, 400);
  });
});

/* 66. Goal Tracker */
T('goals', 'Goal Tracker', 'prod', el => {
  const KEY = 'goals';
  el.innerHTML = `
    <div class="field-row"><input class="inp" id="t" placeholder="Goal"><input type="number" class="inp" id="p" placeholder="Target %" value="100" style="flex:0 0 110px"></div>
    <div class="row"><button class="btn" id="add">Add goal</button></div>
    <div class="list" id="list" style="margin-top:12px"></div>
  `;
  function draw() {
    const arr = LS.get(KEY, []);
    el.querySelector('#list').innerHTML = arr.length ? arr.map((g, i) => `
      <div class="list-item" style="flex-direction:column;align-items:stretch;gap:4px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <strong class="grow">${esc(g.text)}</strong>
          <span class="tiny muted">${g.progress}/${g.target}</span>
          <button class="x" data-del="${i}">×</button>
        </div>
        <input type="range" min="0" max="${g.target}" value="${g.progress}" data-i="${i}" style="width:100%">
      </div>`).join('') : '<p class="muted tiny">No goals yet.</p>';
    el.querySelectorAll('input[type=range]').forEach(r => r.addEventListener('input', () => {
      const arr2 = LS.get(KEY, []); arr2[+r.dataset.i].progress = +r.value; LS.set(KEY, arr2);
      draw();
    }));
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const arr2 = LS.get(KEY, []); arr2.splice(+b.dataset.del, 1); LS.set(KEY, arr2); draw();
    });
  }
  el.querySelector('#add').onclick = () => {
    const t = el.querySelector('#t').value.trim(); if (!t) return;
    const target = parseInt(el.querySelector('#p').value) || 100;
    const arr = LS.get(KEY, []); arr.push({ text: t, target, progress: 0 }); LS.set(KEY, arr);
    el.querySelector('#t').value = ''; draw();
  };
  draw();
});

/* 67. Class Timetable */
T('timetable', 'Class Timetable', 'prod', el => {
  const KEY = 'timetable';
  el.innerHTML = `
    <div class="tt" id="grid"></div>
    <button class="btn" id="save" style="margin-top:12px">Save timetable</button>
  `;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const slots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
  const saved = LS.get(KEY, {});
  el.querySelector('#grid').innerHTML = `
    <table>
      <thead><tr><th></th>${days.map(d => `<th>${d}</th>`).join('')}</tr></thead>
      <tbody>${slots.map(s => `<tr><th>${s}</th>${days.map(d => `<td><input data-k="${d}-${s}" value="${esc(saved[d + '-' + s] || '')}"></td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
  el.querySelector('#save').onclick = () => {
    const map = {};
    el.querySelectorAll('input[data-k]').forEach(i => { if (i.value.trim()) map[i.dataset.k] = i.value.trim(); });
    LS.set(KEY, map); toast('Timetable saved', 'success');
  };
});

/* 68. Assignment Tracker */
T('assignments', 'Assignment Tracker', 'prod', el => {
  const KEY = 'assignments';
  el.innerHTML = `
    <div class="field-row"><input class="inp" id="t" placeholder="Assignment"><input type="date" class="inp" id="d" style="flex:0 0 160px"></div>
    <button class="btn" id="add">Add</button>
    <div class="list" id="list" style="margin-top:12px"></div>
  `;
  function draw() {
    const arr = LS.get(KEY, []).sort((a, b) => (a.due || '').localeCompare(b.due || ''));
    el.querySelector('#list').innerHTML = arr.length ? arr.map((a, i) => {
      const days = a.due ? Math.ceil((new Date(a.due) - new Date()) / 86400000) : null;
      const warn = days !== null && days <= 3 && !a.done;
      return `<div class="list-item ${a.done ? 'done' : ''}">
        <input type="checkbox" class="checkbox" ${a.done ? 'checked' : ''} data-i="${i}">
        <span class="grow">${esc(a.text)} ${a.due ? `<br><span class="sub" style="color:${warn ? 'var(--danger)' : 'inherit'}">Due ${esc(a.due)}${days !== null ? ' · ' + (days >= 0 ? days + 'd' : 'overdue') : ''}</span>` : ''}</span>
        <button class="x" data-del="${i}">×</button>
      </div>`;
    }).join('') : '<p class="muted tiny">No assignments yet.</p>';
    el.querySelectorAll('.checkbox').forEach(cb => cb.addEventListener('change', () => {
      const arr2 = LS.get(KEY, []); arr2[+cb.dataset.i].done = cb.checked; LS.set(KEY, arr2); draw();
    }));
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const arr2 = LS.get(KEY, []); arr2.splice(+b.dataset.del, 1); LS.set(KEY, arr2); draw();
    });
  }
  el.querySelector('#add').onclick = () => {
    const t = el.querySelector('#t').value.trim(); if (!t) return;
    const arr = LS.get(KEY, []);
    arr.push({ text: t, due: el.querySelector('#d').value, done: false });
    LS.set(KEY, arr); el.querySelector('#t').value = ''; draw();
  };
  draw();
});

/* 69. Attendance Calculator */
T('attendance', 'Attendance Calculator', 'prod', el => {
  el.innerHTML = `
    <div class="field-row"><input type="number" class="inp" id="a" placeholder="Classes attended"><input type="number" class="inp" id="t" placeholder="Total classes"></div>
    <div class="field-row"><input type="number" class="inp" id="req" placeholder="Required %" value="75"></div>
    <div class="stats-inline" id="out"></div>
  `;
  const g = id => el.querySelector('#' + id);
  function run() {
    const a = parseInt(g('a').value), t = parseInt(g('t').value), req = parseFloat(g('req').value) || 75;
    if (!isFinite(a) || !isFinite(t) || t <= 0) { g('out').innerHTML = ''; return; }
    const pct = (a / t) * 100;
    let msg;
    if (pct < req) {
      const need = Math.ceil((req * t - 100 * a) / (100 - req));
      msg = `Attend ${need} more class${need === 1 ? '' : 'es'} straight to reach ${req}%`;
    } else {
      const canMiss = Math.floor((100 * a - req * t) / req);
      msg = canMiss > 0 ? `You can miss ${canMiss} more class${canMiss === 1 ? '' : 'es'}` : 'Right at the line';
    }
    g('out').innerHTML = `
      <div class="stat"><span class="stat-v">${fmtNum(pct, 1)}%</span><span class="stat-l">Attendance</span></div>
      <div class="stat"><span class="stat-v">${a}/${t}</span><span class="stat-l">Attended</span></div>
      <div class="stat"><span class="stat-v" style="font-size:.9rem">${esc(msg)}</span><span class="stat-l">Guidance</span></div>
    `;
  }
  el.addEventListener('input', run);
});

/* 70. Shopping List */
T('shopping', 'Shopping List', 'prod', el => {
  const KEY = 'shopping';
  el.innerHTML = `
    <div class="field-row"><input class="inp" id="t" placeholder="Item"><input type="number" class="inp" id="q" placeholder="Qty" value="1" style="flex:0 0 80px"></div>
    <button class="btn" id="add">Add item</button>
    <div class="list" id="list" style="margin-top:12px"></div>
    <button class="btn-ghost" id="clear" style="margin-top:10px">Clear bought items</button>
  `;
  function draw() {
    const arr = LS.get(KEY, []);
    el.querySelector('#list').innerHTML = arr.length ? arr.map((x, i) => `
      <div class="list-item ${x.done ? 'done' : ''}">
        <input type="checkbox" class="checkbox" ${x.done ? 'checked' : ''} data-i="${i}">
        <span class="grow">${esc(x.text)}</span>
        <span class="tiny muted">×${x.qty}</span>
        <button class="x" data-del="${i}">×</button>
      </div>`).join('') : '<p class="muted tiny">Empty list.</p>';
    el.querySelectorAll('.checkbox').forEach(cb => cb.addEventListener('change', () => {
      const arr2 = LS.get(KEY, []); arr2[+cb.dataset.i].done = cb.checked; LS.set(KEY, arr2); draw();
    }));
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const arr2 = LS.get(KEY, []); arr2.splice(+b.dataset.del, 1); LS.set(KEY, arr2); draw();
    });
  }
  el.querySelector('#add').onclick = () => {
    const t = el.querySelector('#t').value.trim(); if (!t) return;
    const q = parseInt(el.querySelector('#q').value) || 1;
    const arr = LS.get(KEY, []); arr.push({ text: t, qty: q, done: false }); LS.set(KEY, arr);
    el.querySelector('#t').value = ''; draw();
  };
  el.querySelector('#clear').onclick = () => {
    LS.set(KEY, LS.get(KEY, []).filter(x => !x.done)); draw();
  };
  draw();
});

/* ============================================================
   BOOT
   ============================================================ */
function init() {
  buildThemeSwitcher();
  applyTheme(LS.get('theme', 'pure-minimal'));

  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('scrim').classList.toggle('on');
  });
  document.getElementById('scrim').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('scrim').classList.remove('on');
  });
  document.getElementById('themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme;
    const idx = THEMES.findIndex(t => t.id === cur);
    applyTheme(THEMES[(idx + 1) % THEMES.length].id);
  });
  document.querySelectorAll('.nav-item').forEach(a => a.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('scrim').classList.remove('on');
  }));

  onRoute();
}
window.addEventListener('DOMContentLoaded', init);
