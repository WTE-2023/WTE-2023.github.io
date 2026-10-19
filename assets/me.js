/* ============================================================
 * 生活小规划师 · 我的（F-006）
 * 进行中目标 / 历史决策：数字点击展开真实列表，可手动添加 / 删除
 * 数据来源：localStorage（lsp.goals 由对话生成，lsp.decisions 由帮我选记录）
 * ============================================================ */
(function () {
  'use strict';

  var LS = {
    get: function (k, dft) {
      try { var v = localStorage.getItem('lsp.' + k); return v ? JSON.parse(v) : dft; }
      catch (e) { return dft; }
    },
    set: function (k, v) { try { localStorage.setItem('lsp.' + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- 样式 ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.ms-cell.clickable{cursor:pointer;transition:.15s;border-radius:12px}' +
    '.ms-cell.clickable:hover{background:rgba(143,185,150,.12)}' +
    '.ms-cell.clickable.open{background:rgba(143,185,150,.18);outline:1.5px solid rgba(143,185,150,.5)}' +
    '.me-panel{animation:cardIn 240ms ease-out both;margin-bottom:14px}' +
    '.me-item{display:flex;align-items:center;gap:10px;padding:10px 2px;border-bottom:1px dashed var(--line,#ECE6DC)}' +
    '.me-item:last-of-type{border-bottom:none}' +
    '.me-item .mi2-body{flex:1;min-width:0}' +
    '.me-item .mi2-title{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.me-item .mi2-sub{font-size:11.5px;color:var(--text-muted,#8A8178)}' +
    '.me-item .mi2-badge{flex:0 0 auto;font-size:11px;background:rgba(143,185,150,.15);color:#4F7057;border-radius:100px;padding:3px 10px;font-variant-numeric:tabular-nums}' +
    '.me-item .mi2-del{flex:0 0 auto;border:none;background:transparent;color:var(--text-muted,#8A8178);font-size:16px;cursor:pointer;padding:2px 6px;border-radius:8px}' +
    '.me-item .mi2-del:hover{color:#B4553F;background:rgba(180,85,63,.08)}' +
    '.me-empty{font-size:12.5px;color:var(--text-muted,#8A8178);text-align:center;padding:12px 0}' +
    '.me-add{display:flex;flex-direction:column;gap:8px;margin-top:10px;padding-top:12px;border-top:1px dashed var(--line,#ECE6DC)}' +
    '.me-add input{padding:9px 12px;border:1px solid var(--line,#ECE6DC);border-radius:10px;font:inherit;font-size:13px;background:#fff}' +
    '.me-add-btn{border:none;border-radius:10px;background:#8FB996;color:#fff;padding:10px 0;font:inherit;font-size:13.5px;cursor:pointer}';
  document.head.appendChild(css);

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtDate(ts) {
    var d = new Date(ts);
    return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }

  /* ---------- 数据 ---------- */
  function goals() { return LS.get('goals', []); }
  function decisions() { return LS.get('decisions', []); }
  function refreshCounts() {
    var g = document.getElementById('ms-goals-num');
    var d = document.getElementById('ms-decisions-num');
    var days = document.getElementById('ms-days-num');
    if (g) g.textContent = goals().length;
    if (d) d.textContent = decisions().length;
    var first = LS.get('firstUse', 0);
    if (!first) { first = Date.now(); LS.set('firstUse', first); }
    if (days) days.textContent = Math.max(1, Math.floor((Date.now() - first) / 86400000) + 1);
  }

  /* ---------- 目标列表 ---------- */
  function renderGoals() {
    var box = document.getElementById('me-goal-list');
    if (!box) return;
    var list = goals();
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<div class="me-empty">还没有目标。在对话里说一句「我要 3 个月后…」，或在下方手动添加</div>'; return; }
    list.forEach(function (g, i) {
      var dayN = Math.min(g.days, Math.max(1, Math.ceil((Date.now() - g.ts) / 86400000)));
      var pct = Math.round(dayN / g.days * 100);
      var row = document.createElement('div');
      row.className = 'me-item';
      row.innerHTML =
        '<div class="mi2-body"><div class="mi2-title"></div>' +
        '<div class="mi2-sub">' + (g.domain || '自定义目标') + ' · ' + fmtDate(g.ts) + ' 开始 · 共 ' + g.days + ' 天</div></div>' +
        '<span class="mi2-badge">第 ' + dayN + ' 天 · ' + pct + '%</span>' +
        '<button class="mi2-del" type="button" aria-label="删除">×</button>';
      row.querySelector('.mi2-title').textContent = g.title;
      row.querySelector('.mi2-del').addEventListener('click', function () {
        var arr = goals(); arr.splice(i, 1); LS.set('goals', arr);
        renderGoals(); refreshCounts();
      });
      box.appendChild(row);
    });
  }

  /* ---------- 决策列表 ---------- */
  function renderDecisions() {
    var box = document.getElementById('me-decision-list');
    if (!box) return;
    var list = decisions();
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<div class="me-empty">还没有决策记录。去「帮我选」做一次选择会自动记入，或在下方手动记录</div>'; return; }
    list.forEach(function (dc, i) {
      var row = document.createElement('div');
      row.className = 'me-item';
      row.innerHTML =
        '<div class="mi2-body"><div class="mi2-title"></div>' +
        '<div class="mi2-sub">' + fmtDate(dc.ts) + (dc.others && dc.others.length ? ' · 放弃了：' + dc.others.join('、') : '') + '</div></div>' +
        '<button class="mi2-del" type="button" aria-label="删除">×</button>';
      row.querySelector('.mi2-title').textContent = dc.q + ' → ' + dc.win;
      row.querySelector('.mi2-del').addEventListener('click', function () {
        var arr = decisions(); arr.splice(i, 1); LS.set('decisions', arr);
        renderDecisions(); refreshCounts();
      });
      box.appendChild(row);
    });
  }

  /* ---------- 面板开合 ---------- */
  function toggle(panelId, cellId) {
    var panel = document.getElementById(panelId);
    var cell = document.getElementById(cellId);
    var open = panel.style.display === 'none';
    document.querySelectorAll('.me-panel').forEach(function (p) { p.style.display = 'none'; });
    document.querySelectorAll('.ms-cell.clickable').forEach(function (c) { c.classList.remove('open'); });
    if (open) {
      panel.style.display = 'block';
      cell.classList.add('open');
      if (panelId === 'panel-goals') renderGoals(); else renderDecisions();
    }
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    var g = document.getElementById('ms-goals');
    if (!g) return;
    g.addEventListener('click', function () { toggle('panel-goals', 'ms-goals'); });
    document.getElementById('ms-decisions').addEventListener('click', function () { toggle('panel-decisions', 'ms-decisions'); });

    document.getElementById('me-goal-add').addEventListener('click', function () {
      var title = (document.getElementById('me-goal-title').value || '').trim();
      var days = parseInt(document.getElementById('me-goal-days').value, 10);
      if (!title || !days || days < 1) return;
      var arr = goals();
      arr.unshift({ title: title, domain: '手动添加', days: days, ts: Date.now(), milestones: [] });
      LS.set('goals', arr);
      document.getElementById('me-goal-title').value = '';
      document.getElementById('me-goal-days').value = '';
      renderGoals(); refreshCounts();
      // 同步规划页头部
      var hero = document.querySelector('#page-plan .goal-hero h3');
      if (hero && arr.length) hero.textContent = arr[0].title;
      var cd = document.querySelector('#page-plan .countdown b');
      if (cd && arr.length) cd.textContent = arr[0].days;
    });

    document.getElementById('me-dec-add').addEventListener('click', function () {
      var q = (document.getElementById('me-dec-q').value || '').trim();
      var win = (document.getElementById('me-dec-win').value || '').trim();
      if (!q || !win) return;
      var arr = decisions();
      arr.unshift({ q: q, win: win, others: [], ts: Date.now() });
      LS.set('decisions', arr);
      document.getElementById('me-dec-q').value = '';
      document.getElementById('me-dec-win').value = '';
      renderDecisions(); refreshCounts();
    });

    refreshCounts();
  }

  window.lspRefreshMe = refreshCounts;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
