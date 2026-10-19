/* ============================================================
 * 生活小规划师 · 多项选择器（F-003 扩展）
 * 用户输入问题 + 多个选项 → AI 选出最佳并给理由
 * 场景知识库（吃/穿/买/去哪/时间安排…）；配置大模型时走 API
 * ============================================================ */
(function () {
  'use strict';

  var LS = {
    get: function (k, dft) {
      try { var v = localStorage.getItem('lsp.' + k); return v ? JSON.parse(v) : dft; }
      catch (e) { return dft; }
    }
  };
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ---------- 场景知识库 ---------- */
  var SCENES = [
    {
      re: /吃|喝|外卖|午餐|晚餐|早餐|夜宵/,
      name: '吃什么',
      prefs: [
        { k: ['辣', '重口', '过瘾'], tag: '够味' },
        { k: ['清淡', '健康', '轻'], tag: '清淡' },
        { k: ['快', '赶时间', '急'], tag: '出餐快' },
        { k: ['便宜', '省钱', '实惠'], tag: '省钱' },
        { k: ['暖', '热乎', '冷'], tag: '暖胃' }
      ],
      attr: {
        '麻辣烫': ['够味', '暖胃'], '火锅': ['够味', '暖胃'], '川菜': ['够味'], '烧烤': ['够味'],
        '轻食沙拉': ['清淡', '健康'], '粥': ['清淡', '暖胃'], '蒸菜': ['清淡', '健康'],
        '兰州拉面': ['出餐快', '暖胃'], '黄焖鸡米饭': ['出餐快', '实惠'], '麦当劳': ['出餐快'], '便利店': ['出餐快', '省钱'],
        '自己做饭': ['省钱', '健康'], '食堂': ['省钱', '出餐快'], '面条': ['暖胃', '出餐快']
      },
      reasons: {
        '够味': '能满足你现在想要的「过瘾感」，情绪价值拉满',
        '清淡': '不给肠胃加负担，吃完下午不犯困',
        '健康': '营养结构更好，连续外食的日子里是个平衡',
        '出餐快': '不占用今天的整块时间，吃完能立刻回到正事',
        '省钱': '对钱包友好，月底不慌',
        '暖胃': '热乎下肚，身体和心情都会松一点',
        '实惠': '份量和价格都稳，性价比之选'
      }
    },
    {
      re: /去哪|去哪玩|周末|假期|旅游|出行/,
      name: '去哪',
      prefs: [
        { k: ['累', '休息', '放松'], tag: '恢复' },
        { k: ['无聊', '闷', '想动'], tag: '激活' },
        { k: ['朋友', '社交'], tag: '连接' }
      ],
      attr: {
        '爬山': ['激活'], '运动': ['激活'], '逛展': ['激活'], '逛街': ['激活'],
        '宅家休息': ['恢复'], '公园散步': ['恢复'], '看电影': ['恢复'],
        '约朋友吃饭': ['连接'], '剧本杀': ['连接', '激活']
      },
      reasons: {
        '恢复': '你这周消耗不小，它能把能量充回来',
        '激活': '能打破最近的沉闷感，给你换换脑子',
        '连接': '好的社交是最好的情绪补品'
      }
    },
    {
      re: /安排|干什么|做什么|怎么过|今晚|晚上/,
      name: '时间安排',
      prefs: [
        { k: ['累', '疲惫'], tag: '低耗' },
        { k: ['充实', '进步'], tag: '投入' }
      ],
      attr: {
        '早点睡觉': ['低耗'], '泡个热水澡': ['低耗'], '看一部电影': ['低耗'],
        '运动 40 分钟': ['投入'], '读 30 页书': ['投入'], '学习 1 小时': ['投入']
      },
      reasons: {
        '低耗': '几乎不消耗意志力，做完只会更舒服',
        '投入': '做完会有「今晚没白费」的踏实感'
      }
    }
  ];
  var GENERIC_PRINCIPLES = [
    { name: '最少后悔原则', desc: '一周后回看，你更可能为「没选它」而遗憾的那个，就是答案。' },
    { name: '先易后难原则', desc: '选启动成本最低的那个，先获得「完成感」，再啃硬的。' },
    { name: '当下需求原则', desc: '不问「哪个最好」，问「哪个最适合此刻的我」。' }
  ];

  /* ---------- 样式 ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.pick-q-row input,.pick-add-row input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--line,#ECE6DC);border-radius:10px;font:inherit;font-size:13.5px;background:#fff}' +
    '.pick-q-row{margin-bottom:8px}' +
    '.pick-add-row{display:flex;gap:8px}' +
    '.pick-add-btn{flex:0 0 auto;border:none;border-radius:10px;background:#8FB996;color:#fff;padding:0 18px;font:inherit;font-size:13px;cursor:pointer}' +
    '.pick-chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 2px}' +
    '.pick-chip{display:inline-flex;align-items:center;gap:5px;background:rgba(143,185,150,.14);color:#4F7057;border-radius:100px;padding:5px 8px 5px 13px;font-size:12.5px}' +
    '.pick-chip b{cursor:pointer;font-weight:400;color:#8A8178;padding:0 4px}' +
    '.pick-chip b:hover{color:#B4553F}' +
    '.pick-quick{font-size:12px;color:var(--text-muted,#8A8178);margin:8px 0 2px}' +
    '.pick-tpl{color:#4F7057;text-decoration:underline;cursor:pointer;margin:0 4px}' +
    '.pick-win{background:linear-gradient(135deg,rgba(143,185,150,.18),rgba(232,168,124,.14));border:1px solid rgba(143,185,150,.5);border-radius:16px;padding:16px;margin-top:12px;animation:cardIn 300ms ease-out both}' +
    '.pw-crown{font-size:12px;color:#B2663A;font-weight:600;letter-spacing:.1em}' +
    '.pw-name{font-size:21px;font-weight:700;color:#33413A;margin:4px 0 8px}' +
    '.pw-why{font-size:13px;line-height:1.7;color:#35513C}' +
    '.pw-why li{margin-bottom:4px}' +
    '.pw-others{margin-top:10px;font-size:12px;color:var(--text-muted,#8A8178);line-height:1.6}' +
    '.pw-again{display:inline-block;margin-top:10px;background:transparent;border:1px solid var(--line,#ECE6DC);border-radius:10px;padding:7px 18px;font:inherit;font-size:12.5px;color:var(--text-muted,#8A8178);cursor:pointer}';
  document.head.appendChild(css);

  /* ---------- 状态 ---------- */
  var options = [];
  var chipsEl, optInput, qInput, resultEl;

  function renderChips() {
    chipsEl.innerHTML = '';
    options.forEach(function (o, i) {
      var c = document.createElement('span');
      c.className = 'pick-chip';
      c.innerHTML = '<span></span><b title="删除">×</b>';
      c.querySelector('span').textContent = o;
      c.querySelector('b').addEventListener('click', function () { options.splice(i, 1); renderChips(); });
      chipsEl.appendChild(c);
    });
  }
  function addOption() {
    var v = (optInput.value || '').trim();
    if (!v) return;
    if (options.indexOf(v) >= 0) { optInput.value = ''; return; }
    options.push(v); optInput.value = ''; optInput.focus();
    renderChips();
  }

  /* ---------- 本地决策 ---------- */
  function localDecide(question, opts) {
    var scene = SCENES.find(function (s) { return s.re.test(question); });
    if (scene) {
      var wanted = [];
      scene.prefs.forEach(function (p) {
        if (p.k.some(function (k) { return question.indexOf(k) >= 0; })) wanted.push(p.tag);
      });
      var best = null, bestScore = -1, bestTags = [];
      opts.forEach(function (o) {
        var tags = scene.attr[o] || [];
        var score = wanted.length
          ? tags.filter(function (t) { return wanted.indexOf(t) >= 0; }).length * 10 + tags.length
          : tags.length * 10 + Math.random() * 4;
        if (score > bestScore) { bestScore = score; best = o; bestTags = tags; }
      });
      // 没命中属性表：保底选一个并说明
      if (!bestTags.length) {
        best = pick(opts);
        return {
          win: best,
          whys: ['在「' + scene.name + '」这类日常选择里，它们差距本就不大——真正重要的是结束纠结，把精力留给今天更重要的事。'],
          principle: GENERIC_PRINCIPLES[2],
          others: opts.filter(function (o) { return o !== best; })
        };
      }
      return {
        win: best,
        whys: bestTags.map(function (t) { return scene.reasons[t] || ('符合「' + t + '」'); }),
        principle: wanted.length ? { name: '需求匹配', desc: '按你在问题里透露的偏好（' + wanted.join('、') + '）做的选择。' } : GENERIC_PRINCIPLES[2],
        others: opts.filter(function (o) { return o !== best; })
      };
    }
    // 通用场景
    var pr = pick(GENERIC_PRINCIPLES);
    var win = pick(opts);
    return {
      win: win,
      whys: [pr.desc, '其余选项并没有错，只是在此刻的优先级里，它更值得先被做。'],
      principle: pr,
      others: opts.filter(function (o) { return o !== win; })
    };
  }

  /* ---------- API ---------- */
  function apiDecide(question, opts) {
    var cfg = LS.get('api', { url: '', key: '', model: 'deepseek-chat' });
    if (!cfg.url || !cfg.key) return Promise.reject(new Error('no-api'));
    var prompt = '用户的问题是：「' + question + '」。候选选项：' + opts.join('、') +
      '。请从中选出一个最佳选项，严格按以下格式输出（不要其他内容）：\n推荐：<选项原文>\n理由1：<一句具体理由>\n理由2：<一句具体理由>\n简评：<一句话点评其余选项>';
    return fetch(cfg.url.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model || 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.7 })
    }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) {
        var t = j.choices[0].message.content;
        function g(k) { var m = t.match(new RegExp(k + '[：:]\\s*(.+)')); return m ? m[1].trim() : ''; }
        var win = g('推荐');
        if (opts.indexOf(win) < 0) {
          var hit = opts.find(function (o) { return win.indexOf(o) >= 0 || o.indexOf(win) >= 0; });
          win = hit || opts[0];
        }
        return {
          win: win,
          whys: [g('理由1'), g('理由2')].filter(Boolean),
          principle: null,
          others: opts.filter(function (o) { return o !== win; }),
          othersNote: g('简评')
        };
      });
  }

  /* ---------- 渲染 ---------- */
  function renderResult(r, question) {
    // 记入历史决策（供「我的」页展示）
    try {
      var arr = JSON.parse(localStorage.getItem('lsp.decisions') || '[]');
      arr.unshift({ q: question, win: r.win, others: r.others, ts: Date.now() });
      if (arr.length > 50) arr.length = 50;
      localStorage.setItem('lsp.decisions', JSON.stringify(arr));
      if (window.lspRefreshMe) window.lspRefreshMe();
    } catch (e) {}
    resultEl.innerHTML = '';
    var d = document.createElement('div');
    d.className = 'pick-win';
    var whyHtml = '<ul style="margin:0;padding-left:18px;">' + r.whys.map(function (w) { return '<li>' + w + '</li>'; }).join('') + '</ul>';
    d.innerHTML =
      '<div class="pw-crown">AI 推荐</div>' +
      '<div class="pw-name"></div>' +
      '<div class="pw-why">' + whyHtml +
      (r.principle ? '<div style="margin-top:8px;font-size:12px;color:var(--text-muted,#8A8178)">决策依据 · ' + r.principle.name + '：' + r.principle.desc + '</div>' : '') +
      '</div>' +
      (r.others.length ? '<div class="pw-others">' + (r.othersNote || ('其余选项：' + r.others.join('、') + '——不是不好，只是今天它更合适。')) + '</div>' : '') +
      '<button class="pw-again" type="button">不满意？再选一次</button>';
    d.querySelector('.pw-name').textContent = r.win;
    d.querySelector('.pw-again').addEventListener('click', go);
    resultEl.appendChild(d);
    d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function go() {
    var question = (qInput.value || '').trim() || '帮我选一个';
    if (options.length < 2) {
      optInput.focus();
      optInput.placeholder = '至少需要 2 个选项才能帮你选';
      return;
    }
    resultEl.innerHTML = '<div class="pick-win"><div class="pw-why" style="color:var(--text-muted,#8A8178)">正在为你权衡 ' + options.length + ' 个选项…</div></div>';
    apiDecide(question, options).then(
      function (r) { renderResult(r, question); },
      function () { setTimeout(function () { renderResult(localDecide(question, options), question); }, 600); }
    );
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    chipsEl = document.getElementById('pick-chips');
    optInput = document.getElementById('pick-option');
    qInput = document.getElementById('pick-question');
    resultEl = document.getElementById('pick-result');
    if (!chipsEl) return;

    document.getElementById('pick-add').addEventListener('click', addOption);
    optInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') addOption(); });
    document.getElementById('pick-go').addEventListener('click', go);

    document.querySelectorAll('.pick-tpl').forEach(function (t) {
      t.addEventListener('click', function () {
        var parts = t.getAttribute('data-tpl').split('|');
        qInput.value = parts[0];
        options = parts[1] ? parts[1].split(',') : [];
        renderChips();
        resultEl.innerHTML = '';
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
