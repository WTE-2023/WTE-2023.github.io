/* ============================================================
 * 生活小规划师 · 工具箱 v2（F-005）
 * 时间计算：倒计时 / 正向计时，可添加多项，每秒实时刷新，localStorage 持久化
 * 文字工具：用户输入原文 → 润色 / 总结（本地规则，配置大模型时走 API）
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 存储 ---------- */
  var LS = {
    get: function (k, dft) {
      try { var v = localStorage.getItem('lsp.' + k); return v ? JSON.parse(v) : dft; }
      catch (e) { return dft; }
    },
    set: function (k, v) { try { localStorage.setItem('lsp.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var timers = LS.get('timers', []);        // [{id,name,ts,mode:'down'|'up'}]
  var curMode = LS.get('timerMode', 'down');
  function saveTimers() { LS.set('timers', timers); }

  /* ---------- 样式 ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.timer-tabs{display:flex;gap:6px;margin-bottom:12px;background:var(--bg-sunken,#F1EBE2);border-radius:12px;padding:4px}' +
    '.ttab{flex:1;border:none;background:transparent;padding:8px 0;border-radius:9px;font:inherit;font-size:13.5px;color:var(--text-muted,#8A8178);cursor:pointer;transition:.18s}' +
    '.ttab.active{background:#fff;color:var(--primary-deep,#4F7057);font-weight:600;box-shadow:0 1px 4px rgba(51,65,58,.12)}' +
    '.timer-add{display:flex;flex-direction:column;gap:8px}' +
    '.timer-add input{padding:9px 12px;border:1px solid var(--line,#ECE6DC);border-radius:10px;font:inherit;font-size:13px;background:#fff}' +
    '.timer-add-btn{border:none;border-radius:10px;background:#8FB996;color:#fff;padding:10px 0;font:inherit;font-size:13.5px;cursor:pointer}' +
    '.timer-add-btn:active{transform:scale(.98)}' +
    '.timer-hint{font-size:11.5px;color:var(--text-muted,#8A8178);margin:8px 0 2px}' +
    '.timer-row{display:flex;align-items:center;gap:10px;padding:11px 2px;border-bottom:1px dashed var(--line,#ECE6DC)}' +
    '.timer-row:last-child{border-bottom:none}' +
    '.tr-body{flex:1;min-width:0}' +
    '.tr-name{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.tr-sub{font-size:11px;color:var(--text-muted,#8A8178)}' +
    '.tr-val{font-size:17px;font-weight:700;color:var(--primary-deep,#4F7057);white-space:nowrap;font-variant-numeric:tabular-nums}' +
    '.tr-val.done{color:#B4553F}' +
    '.tr-del{border:none;background:transparent;color:var(--text-muted,#8A8178);cursor:pointer;font-size:16px;padding:4px 6px;border-radius:8px}' +
    '.tr-del:hover{color:#B4553F;background:rgba(180,85,63,.08)}' +
    '.timer-empty{font-size:12.5px;color:var(--text-muted,#8A8178);text-align:center;padding:14px 0 8px}' +
    '#wt-input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--line,#ECE6DC);border-radius:10px;font:inherit;font-size:13px;line-height:1.6;resize:vertical;background:#fff}' +
    '.wt-actions{display:flex;gap:8px;margin-top:10px}' +
    '.wt-btn{border:1px solid var(--line,#ECE6DC);background:#fff;color:var(--primary-deep,#4F7057);border-radius:10px;padding:9px 22px;font:inherit;font-size:13.5px;cursor:pointer}' +
    '.wt-btn.primary{background:#8FB996;border-color:transparent;color:#fff}' +
    '.wt-btn:disabled{opacity:.5;cursor:default}';
  document.head.appendChild(css);

  /* ---------- 时间格式化 ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtDiff(ms) {
    var neg = ms < 0; if (neg) ms = -ms;
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    if (d > 0) return d + ' 天 ' + pad(h) + ':' + pad(m) + ':' + pad(s);
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }
  function fmtDate(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /* ---------- 计时器渲染 ---------- */
  var listEl, nameEl, dateEl, hintEl;
  function renderTimers() {
    if (!listEl) return;
    var now = Date.now();
    if (!timers.length) {
      listEl.innerHTML = '<div class="timer-empty">还没有' + (curMode === 'down' ? '倒计时' : '正向计时') + '，添加一个试试</div>';
      return;
    }
    listEl.innerHTML = '';
    timers.forEach(function (t) {
      var row = document.createElement('div');
      row.className = 'timer-row';
      var val, valCls = 'tr-val', sub;
      if (t.mode === 'down') {
        var left = t.ts - now;
        if (left <= 0) { val = '已到时间'; valCls += ' done'; }
        else val = '还剩 ' + fmtDiff(left);
        sub = '截止 ' + fmtDate(t.ts);
      } else {
        val = '已过 ' + fmtDiff(now - t.ts);
        sub = '开始 ' + fmtDate(t.ts);
      }
      row.innerHTML =
        '<div class="tr-body"><div class="tr-name"></div><div class="tr-sub">' + sub + '</div></div>' +
        '<span class="' + valCls + '">' + val + '</span>' +
        '<button class="tr-del" type="button" aria-label="删除">×</button>';
      row.querySelector('.tr-name').textContent = t.name;
      row.querySelector('.tr-del').addEventListener('click', function () {
        timers = timers.filter(function (x) { return x.id !== t.id; });
        saveTimers(); renderTimers();
      });
      listEl.appendChild(row);
    });
  }

  function setMode(mode) {
    curMode = mode; LS.set('timerMode', mode);
    document.getElementById('tab-countdown').classList.toggle('active', mode === 'down');
    document.getElementById('tab-countup').classList.toggle('active', mode === 'up');
    if (hintEl) hintEl.textContent = mode === 'down'
      ? '倒计时：选一个未来的时间点，实时显示还剩多久'
      : '正向计时：选一个开始的时刻（如开始健身那天），实时显示已坚持多久';
    renderTimers();
  }

  /* ---------- 文字工具 ---------- */
  var FILLER = /(就是|然后|那个|嗯|啊|其实|说实话|基本上|大概可能)/g;
  var POLISH_MAP = [
    [/还行|还可以/g, '整体不错'],
    [/可能要改一下|可能要修改/g, '有几处细节需要调整'],
    [/你看下|你看看/g, '方便时我们一起确认一下'],
    [/我觉得/g, '我认为'],
    [/咋办|怎么办/g, '如何处理'],
    [/搞定/g, '完成'],
    [/快点/g, '尽快'],
    [/东西/g, '内容']
  ];
  function localPolish(text) {
    var s = text.replace(FILLER, '').replace(/\s+/g, ' ').trim();
    POLISH_MAP.forEach(function (p) { s = s.replace(p[0], p[1]); });
    s = s.replace(/，{2,}/g, '，').replace(/。。+/g, '。');
    // 超长句按逗号拆分为两句
    s = s.replace(/([^。！？]{30,}?)，/g, '$1。');
    if (!/[。！？!?]$/.test(s)) s += '。';
    return s + '\n\n—— 本地润色主要做了：去口头禅、口语转书面语、长句拆分。配置大模型后可获得更自然的重写。';
  }
  function localSummary(text) {
    var sents = text.split(/(?<=[。！？!?\n])/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 3; });
    if (!sents.length) return '内容太短，无法总结。';
    if (sents.length === 1) return '一句话总结：' + sents[0];
    var KEYS = ['所以', '因此', '决定', '需要', '应该', '必须', '计划', '目标', '注意', '关键', '重要', '问题', '建议'];
    var scored = sents.map(function (s, i) {
      var score = 0;
      KEYS.forEach(function (k) { if (s.indexOf(k) >= 0) score += 2; });
      if (i === 0) score += 1;
      if (s.length >= 10 && s.length <= 45) score += 1;
      return { s: s, score: score, i: i };
    });
    var top = scored.slice().sort(function (a, b) { return b.score - a.score; })
      .slice(0, Math.min(3, sents.length)).sort(function (a, b) { return a.i - b.i; });
    return '要点（' + top.length + ' 条）：\n' +
      top.map(function (t, i) { return (i + 1) + '. ' + t.s.replace(/[。！？!?]$/, ''); }).join('\n') +
      '\n\n—— 本地总结通过关键词与位置提取要点。配置大模型后可获得更准确的语义摘要。';
  }
  function apiText(text, mode) {
    var cfg = LS.get('api', { url: '', key: '', model: 'deepseek-chat' });
    if (!cfg.url || !cfg.key) return Promise.reject(new Error('no-api'));
    var prompt = mode === 'polish'
      ? '请润色下面这段文字：保留原意，去掉口语和口头禅，让表达更得体、清晰、有礼貌。只输出润色后的文字，不要解释。\n\n' + text
      : '请总结下面这段文字：先用一句话概括，再列出不超过 4 条要点。只输出总结，不要解释。\n\n' + text;
    return fetch(cfg.url.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model || 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.5 })
    }).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
      .then(function (j) {
        var t = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (!t) throw new Error('empty');
        return t;
      });
  }

  function runTextTool(mode) {
    var input = document.getElementById('wt-input');
    var wrap = document.getElementById('wt-out-wrap');
    var out = document.getElementById('wt-out');
    var label = document.getElementById('wt-out-label');
    var text = (input.value || '').trim();
    if (!text) { input.focus(); input.placeholder = '先输入一段文字再点按钮'; return; }
    wrap.style.display = 'block';
    label.textContent = mode === 'polish' ? '润色后' : '总结';
    out.textContent = '处理中…';
    apiText(text, mode).then(function (r) { out.textContent = r; }, function () {
      out.textContent = mode === 'polish' ? localPolish(text) : localSummary(text);
    });
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    listEl = document.getElementById('timer-list');
    nameEl = document.getElementById('timer-name');
    dateEl = document.getElementById('timer-date');
    hintEl = document.getElementById('timer-hint');
    if (!listEl) return;

    document.getElementById('tab-countdown').addEventListener('click', function () { setMode('down'); });
    document.getElementById('tab-countup').addEventListener('click', function () { setMode('up'); });

    document.getElementById('timer-add-btn').addEventListener('click', function () {
      var name = (nameEl.value || '').trim() || (curMode === 'down' ? '未命名倒计时' : '未命名计时');
      var dv = dateEl.value;
      if (!dv) { dateEl.focus(); return; }
      var ts = new Date(dv).getTime();
      if (isNaN(ts)) return;
      if (curMode === 'down' && ts <= Date.now()) {
        hintEl.textContent = '倒计时需要选未来的时间点';
        return;
      }
      timers.push({ id: Date.now() + Math.random(), name: name, ts: ts, mode: curMode });
      saveTimers();
      nameEl.value = ''; dateEl.value = '';
      renderTimers();
    });

    document.getElementById('wt-polish').addEventListener('click', function () { runTextTool('polish'); });
    document.getElementById('wt-summary').addEventListener('click', function () { runTextTool('summary'); });
    document.getElementById('wt-copy').addEventListener('click', function () {
      var t = document.getElementById('wt-out').textContent || '';
      var done = function () { if (window.copyText) window.copyText(document.getElementById('wt-copy'), '已复制'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, done);
      else done();
    });

    setMode(curMode);
    setInterval(renderTimers, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
