/* ============================================================
 * 生活小规划师 · 思绪梳理引导流（F-004）
 * 说出情绪 → AI 分析原因 → 定制解决方案 → 呼吸引导 → 前后对比
 * 本地知识库驱动；配置大模型时分析环节走 API
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
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ---------- 共情话术（按情绪词） ---------- */
  var EMPATHY = {
    '焦虑': ['焦虑是「对未来失控」的警报——它在提醒你重视这件事，不代表你应付不了。', '你在乎，所以才会焦虑。我们先把这个警报声调小一点。'],
    '烦躁': ['烦躁往往是「累了 + 被打断」叠在一起的信号，不是你脾气差。', '烦躁的时候，说明你的能量槽已经见底了。先不责怪自己。'],
    '低落': ['低落像心里压了一块湿毛巾，沉、而且说不清具体是哪件事。这很正常，我们可以慢慢拧干它。', '愿意承认低落，比硬撑着「我没事」勇敢得多。'],
    '压力大': ['压力 = 你在意的事 × 你给自己加码的标准。两个都可以调。', '扛着压力走到现在，说明你的承受力比你以为的强。'],
    '孤独': ['孤独不是「没人陪」，而是「没人懂」。我们先把这份感受说清楚。', '深夜的孤独感会被放大，现在说出它，天就亮了一半。'],
    '迷茫': ['迷茫说明你在认真思考方向——糊里糊涂的人是不会迷茫的。', '找不到方向的时候，先找「下一步」，不用找「这一生」。'],
    '愤怒': ['愤怒底下通常藏着「被不公平对待」或「边界被踩」。它有信息，值得被听见。', '先让情绪过去，再决定怎么处理事。你不需要为愤怒本身道歉。'],
    '疲惫': ['累到不想动，是身体在替你喊停。听话，先照顾它。', '长期的疲惫不是懒，是透支。我们来找找哪里漏了电。'],
    '_default': ['这份感受是真实的，值得被认真对待。', '谢谢你愿意说出来。我们一起来看看它。']
  };

  /* ---------- 归因知识库 ---------- */
  var CAUSES = [
    { re: /汇报|演讲|面试|展示|发言|答辩/, name: '表现焦虑',
      why: '你担心的可能不是事情本身，而是「被评价」。大脑把「一次表现」错误地等同于「我的全部价值」，所以警报被放大了。',
      facts: ['这是一次具体的事件，有明确的开始和结束', '听众关注的是内容，不是在给你这个人打分'],
      todo: ['把内容缩成 3 个关键词写在手心，有锚点就不怕断片', '提前 10 分钟到场熟悉环境，陌生感会减半'],
      week: '找一次低风险场合（比如和朋友）演练一遍，大脑有了「成功记忆」，下次警报会小很多。' },
    { re: /工作|加班|老板|同事|裁员|绩效|职场|任务|deadline|ddl/i, name: '工作压力',
      why: '工作类情绪的重叠度最高：任务量、被评价的恐惧、边界被侵占往往同时出现。你的疲惫感可能来自「持续在线」，而不是某一件事。',
      facts: ['任务可以排序，但你的精力不是无限的', '别人的期待 ≠ 你的义务'],
      todo: ['列出所有任务，只圈出「明天必须完成的 1 件」，其余的标注日期后从脑子里删掉', '今晚设一个「下班仪式」：关机 / 换鞋 / 一句话告诉自己今天到此为止'],
      week: '观察一周：哪个时间段你的效率最高？把最重要的事固定放进去，其余时间允许自己「普通」。' },
    { re: /感情|对象|男朋友|女朋友|分手|吵架|喜欢|暗恋|婚姻|伴侣/, name: '关系困扰',
      why: '关系里的情绪常常不是因为「发生了什么」，而是「我们如何解读它」。同一个行为，可以解读为「TA 不在乎我」，也可以是「TA 最近也累」。',
      facts: ['你看到的是行为，动机是你猜的', '你的感受值得被表达，而不是被压下去'],
      todo: ['把想说的话写在备忘录（不发），写完读一遍，标出「事实」和「我的解读」', '今晚不做法定性谈话，重大决定不在情绪里做'],
      week: '等情绪平稳后，用「我」开头表达一次：「当……发生时，我感到……，我希望……」——不指责，只说感受。' },
    { re: /考试|成绩|学习|挂科|论文|毕业|学业|复习|考研|考公/, name: '学业压力',
      why: '学业焦虑的配方通常是「大目标 × 模糊的进度 × 和别人比较」。你不是不努力，是看不见自己走了多远。',
      facts: ['进度看不见 ≠ 没有进度', '别人的节奏是他的，你的基线只有你自己'],
      todo: ['把剩余内容切成「到考试前每周一块」，今天只碰本周那块的第一小节', '睡前写下「今天学会的一个点」，给大脑一个交代'],
      week: '做一次限时自测，用真实的分数替代想象中的恐慌——多数时候，真实没想象可怕。' },
    { re: /父母|家庭|家人|妈|爸|亲戚|催婚|催生/, name: '家庭关系',
      why: '家庭情绪的难点在于：爱、期待、控制常常缠在一起。你可能既想让他们满意，又想保住自己——两种愿望都是正当的。',
      facts: ['他们的人生课题（如焦虑、面子）不属于你的任务清单', '你可以爱他们，同时不按他们的剧本生活'],
      todo: ['今晚先分清：这件事里「我的责任」是什么，「他们的课题」是什么，各写一行', '给自己 10 分钟不看家庭群消息的许可'],
      week: '准备一句温和的边界话术，如「我知道你们担心，这件事我想自己先试试」，练到能平静说出来。' },
    { re: /钱|经济|房租|工资|负债|存款|开销|花呗|信用卡/, name: '经济焦虑',
      why: '钱的焦虑本质是安全感的焦虑。模糊的「钱不够」比具体的数字更吓人——大脑会把未知自动脑补成灾难。',
      facts: ['数字看清楚后，问题就从「一团雾」变成「一张清单」', '焦虑不增加收入，但清单能'],
      todo: ['今晚只算两笔账：每月固定收入、每月固定支出，发给自己', '找出一笔「想起来就心疼」的支出，决定它下个月的去留'],
      week: '开一个单独的储蓄账户，哪怕每月只转 100——「在存」这个动作本身就会降低焦虑。' },
    { re: /睡不着|失眠|熬夜|睡眠|凌晨|夜/, name: '睡眠困扰',
      why: '深夜反刍通常是因为白天没给情绪留出口，它们只能趁安静涌上来。越想睡越睡不着，是因为「努力睡」本身就是一种唤醒。',
      facts: ['躺在床上 ≠ 必须立刻睡着', '凌晨 3 点的想法往往比白天的悲观，可信度打折'],
      todo: ['把脑子里盘旋的事写在纸上，告诉自己「已存档，明天处理」', '配合下面的呼吸练习做 3 轮，身体先睡，脑子会跟上'],
      week: '固定起床时间（哪怕周末），一周后入睡会明显变快——生物钟只认起床闹钟。' },
    { re: /身体|健康|生病|体检|疼|痛/, name: '健康担忧',
      why: '对健康的担忧容易被搜索引擎放大——小症状总能搜出大疾病。这种「灾难化联想」是焦虑的标准动作。',
      facts: ['搜索引擎给的是概率，不是诊断', '你已经注意到身体信号，这本身就是负责的表现'],
      todo: ['停止反复搜索症状，把担心写在纸上', '如果担心持续，预约一次正规检查——确定的答案比无限猜想省力'],
      week: '给健康担忧配一个「实际行动」：规律睡眠或每周 3 次快走，行动感是对抗无力感的特效药。' }
  ];
  var CAUSE_DEFAULT = {
    name: '情绪梳理',
    why: '看不清来源的情绪往往由好几件小事叠加——单拎出来每件都不大，堆在一起就满了。这不是你脆弱，是负荷真实存在。',
    facts: ['情绪没有「该不该」，只有「是什么」', '此刻的难受是暂时的状态，不是你的属性'],
    todo: ['把此刻脑子里闪过的任何念头写下来，不评判、不整理，写完就行', '做一件 5 分钟的身体动作：倒水、拉伸、站到窗边'],
    week: '留意一下：这种情绪通常在什么时间、什么场景出现？找到规律，就找到了开关。'
  };

  /* ---------- 样式 ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.mind-q{font-size:15.5px;font-weight:600;margin-bottom:10px;color:var(--text-main,#33413A)}' +
    '.mood-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}' +
    '.mood-chips button{border:1px solid var(--line,#ECE6DC);background:#fff;border-radius:100px;padding:6px 14px;font:inherit;font-size:12.5px;color:var(--text-muted,#8A8178);cursor:pointer;transition:.15s}' +
    '.mood-chips button.on{background:rgba(143,185,150,.16);border-color:#8FB996;color:#4F7057;font-weight:600}' +
    '#mind-input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--line,#ECE6DC);border-radius:10px;font:inherit;font-size:13px;line-height:1.6;resize:vertical;background:#fff}' +
    '.mind-go{width:100%;margin-top:14px;border:none;border-radius:12px;background:#8FB996;color:#fff;padding:12px 0;font:inherit;font-size:14.5px;font-weight:600;cursor:pointer}' +
    '.mind-go:active{transform:scale(.98)}' +
    '.mind-card{margin-top:12px;animation:cardIn 260ms ease-out both}' +
    '.mind-card .mc-t{font-size:13px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:6px}' +
    '.mind-card .mc-b{font-size:13px;line-height:1.7;color:var(--text-main,#33413A);white-space:pre-wrap}' +
    '.mind-card ul{margin:4px 0 0;padding-left:18px}' +
    '.mind-card li{font-size:12.5px;line-height:1.65;margin-bottom:3px}' +
    '.breath-stage{display:flex;flex-direction:column;align-items:center;padding:18px 0 8px}' +
    '.breath-circle{width:110px;height:110px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#B7D8BC,#8FB996);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:600;transition:transform 4s ease-in-out;box-shadow:0 6px 24px rgba(143,185,150,.4)}' +
    '.breath-phase{margin-top:14px;font-size:13.5px;color:var(--primary-deep,#4F7057);font-weight:600}' +
    '.breath-count{font-size:11.5px;color:var(--text-muted,#8A8178);margin-top:4px}' +
    '.mind-after-val{font-size:26px;font-weight:700;text-align:center;color:var(--primary-deep,#4F7057);margin:6px 0}' +
    '.mind-result{text-align:center;font-size:13px;line-height:1.7;padding:6px 4px 2px}' +
    '.mind-again{display:block;margin:10px auto 0;background:transparent;border:1px solid var(--line,#ECE6DC);border-radius:10px;padding:8px 20px;font:inherit;font-size:12.5px;color:var(--text-muted,#8A8178);cursor:pointer}';
  document.head.appendChild(css);

  /* ---------- 状态 ---------- */
  var flowEl, beforeScore = 5, selectedMoods = [];

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function scrollToEl(node) {
    var body = document.querySelector('#page-mind .page-body');
    if (body && node) setTimeout(function () { node.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 80);
  }
  function saveMood(score, note) {
    var moods = LS.get('moods', []);
    moods.push({ score: score, note: note, ts: Date.now() });
    if (moods.length > 60) moods.shift();
    LS.set('moods', moods);
  }

  /* ---------- 步骤 2：分析 ---------- */
  function analyze() {
    var input = document.getElementById('mind-input');
    var text = (input.value || '').trim();
    if (!text && !selectedMoods.length) {
      input.focus(); input.placeholder = '写一句话也可以，或者先点一个情绪标签';
      return;
    }
    beforeScore = +document.getElementById('mind-score').value;
    saveMood(beforeScore, '梳理前 · ' + (text || selectedMoods.join('、')).slice(0, 30));

    document.getElementById('mind-step1').style.display = 'none';
    flowEl.innerHTML = '';

    var thinking = el('div', 'card mind-card', '<div class="mc-b" style="color:var(--text-muted,#8A8178)">我在读你写的内容，稍等…</div>');
    flowEl.appendChild(thinking);

    var full = text + ' ' + selectedMoods.join(' ');
    var apiCfg = LS.get('api', { url: '', key: '' });
    var render = function (data) {
      thinking.remove();
      renderAnalysis(data, full);
    };

    if (apiCfg.url && apiCfg.key) {
      fetch(apiCfg.url.replace(/\/+$/, '') + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiCfg.key },
        body: JSON.stringify({
          model: apiCfg.model || 'deepseek-chat', temperature: 0.7,
          messages: [
            { role: 'system', content: '你是温柔专业的情绪梳理师。严格按以下格式输出（不要加其他内容）：\n共情：<一句接住用户情绪的话，引用其原句片段>\n原因：<2~3句，分析情绪最可能的来源，具体、不空泛>\n事实1：<一条客观事实>\n事实2：<一条客观事实>\n行动1：<今天可做的一件小事>\n行动2：<今天可做的另一件小事>\n本周：<一条本周可尝试的建议>' },
            { role: 'user', content: '情绪标签：' + (selectedMoods.join('、') || '未选') + '\n强度：' + beforeScore + '/10\n用户原话：' + text }
          ]
        })
      }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (j) {
          var t = j.choices[0].message.content;
          render(parseApiResult(t, full));
        })
        .catch(function () { render(localAnalyze(full)); });
    } else {
      setTimeout(function () { render(localAnalyze(full)); }, 700);
    }
  }

  function parseApiResult(t, full) {
    function g(k) { var m = t.match(new RegExp(k + '[：:]\\s*(.+)')); return m ? m[1].trim() : ''; }
    return {
      empathy: g('共情') || pick(EMPATHY._default),
      why: g('原因') || CAUSE_DEFAULT.why,
      facts: [g('事实1'), g('事实2')].filter(Boolean),
      todo: [g('行动1'), g('行动2')].filter(Boolean),
      week: g('本周') || CAUSE_DEFAULT.week,
      name: 'AI 分析'
    };
  }
  function localAnalyze(full) {
    var cause = CAUSES.find(function (c) { return c.re.test(full); }) || CAUSE_DEFAULT;
    var mood = selectedMoods[0] || '_default';
    return {
      empathy: pick(EMPATHY[mood] || EMPATHY._default),
      why: cause.why,
      facts: cause.facts,
      todo: cause.todo,
      week: cause.week,
      name: cause.name
    };
  }

  /* ---------- 步骤 2 渲染 + 步骤 3 入口 ---------- */
  function renderAnalysis(d, full) {
    var moodTag = selectedMoods.length ? '（' + selectedMoods.join('、') + ' · ' + beforeScore + '/10）' : '（' + beforeScore + '/10）';

    var c1 = el('div', 'card mind-card');
    c1.style.cssText = 'background:var(--primary-light);border-color:rgba(143,185,150,.45);';
    c1.appendChild(el('div', 'mc-t', '先接住你 ' + moodTag));
    c1.appendChild(el('div', 'mc-b')).textContent = d.empathy;
    flowEl.appendChild(c1);

    var c2 = el('div', 'card mind-card');
    c2.appendChild(el('div', 'mc-t', '这份情绪可能来自哪里 · ' + d.name));
    c2.appendChild(el('div', 'mc-b')).textContent = d.why;
    if (d.facts.length) {
      c2.appendChild(el('div', 'mc-t', '两件值得记住的事实'));
      var ul = el('ul'); d.facts.forEach(function (f) { ul.appendChild(el('li')).textContent = f; });
      c2.appendChild(ul);
    }
    flowEl.appendChild(c2);

    var c3 = el('div', 'card mind-card');
    c3.appendChild(el('div', 'mc-t', '现在就能做的'));
    var ul2 = el('ul'); d.todo.forEach(function (f) { ul2.appendChild(el('li')).textContent = f; });
    c3.appendChild(ul2);
    c3.appendChild(el('div', 'mc-t', '本周试试'));
    c3.appendChild(el('div', 'mc-b')).textContent = d.week;
    flowEl.appendChild(c3);

    var c4 = el('div', 'card mind-card');
    c4.appendChild(el('div', 'mc-t', '先让身体松下来 · 4-7-8 呼吸'));
    var stage = el('div', 'breath-stage');
    stage.innerHTML =
      '<div class="breath-circle" id="br-circle">准备</div>' +
      '<div class="breath-phase" id="br-phase">点击下方按钮开始（共 3 轮）</div>' +
      '<div class="breath-count" id="br-count"></div>' +
      '<button class="mind-go" id="br-start" type="button" style="margin-top:14px;width:auto;padding:10px 36px;">开始呼吸练习</button>';
    c4.appendChild(stage);
    flowEl.appendChild(c4);
    scrollToEl(c4);

    c4.querySelector('#br-start').addEventListener('click', function () {
      runBreathing(c4, function () { renderAfter(); });
    });
  }

  /* ---------- 步骤 3：呼吸引导 ---------- */
  function runBreathing(card, done) {
    var circle = card.querySelector('#br-circle');
    var phase = card.querySelector('#br-phase');
    var count = card.querySelector('#br-count');
    var btn = card.querySelector('#br-start');
    btn.disabled = true; btn.style.opacity = '.5';

    var rounds = 3, steps = [
      { label: '吸气', secs: 4, scale: 1.35 },
      { label: '屏息', secs: 7, scale: 1.35 },
      { label: '呼气', secs: 8, scale: 1.0 }
    ];
    var r = 0, s = 0;
    function next() {
      if (r >= rounds) {
        circle.style.transform = 'scale(1)';
        circle.textContent = '完成';
        phase.textContent = '做得很好。注意到身体的变化了吗？';
        count.textContent = '';
        done();
        return;
      }
      var st = steps[s];
      circle.style.transitionDuration = st.secs + 's';
      circle.style.transform = 'scale(' + st.scale + ')';
      circle.textContent = st.label;
      phase.textContent = st.label + ' · ' + st.secs + ' 秒';
      count.textContent = '第 ' + (r + 1) + ' / ' + rounds + ' 轮';
      s++;
      if (s >= steps.length) { s = 0; r++; }
      setTimeout(next, st.secs * 1000);
    }
    next();
  }

  /* ---------- 步骤 4：结束评分 + 对比 ---------- */
  function renderAfter() {
    var c = el('div', 'card mind-card');
    c.innerHTML =
      '<div class="mc-t">现在，再感受一次</div>' +
      '<div class="scale-cap" style="font-size:12px;color:var(--text-muted,#8A8178);">滑动打分（1 仍很重 ~ 10 已平静）</div>' +
      '<div class="mind-after-val" id="af-val">5</div>' +
      '<input type="range" class="emotion-range" id="af-range" min="1" max="10" value="5" style="width:100%">' +
      '<button class="mind-go" id="af-done" type="button">完成这次梳理</button>' +
      '<div class="mind-result" id="af-result"></div>';
    flowEl.appendChild(c);
    scrollToEl(c);

    var range = c.querySelector('#af-range'), val = c.querySelector('#af-val');
    range.addEventListener('input', function () { val.textContent = range.value; });
    c.querySelector('#af-done').addEventListener('click', function () {
      var after = +range.value;
      saveMood(after, '梳理后');
      var diff = after - beforeScore;
      var msg;
      if (diff >= 2) msg = '从 ' + beforeScore + ' 到 ' + after + '，上升了 ' + diff + ' 分。这是你自己做到的——情绪被说清楚之后，真的会轻。把这次的方法记住，下次它还会帮你。';
      else if (diff === 1) msg = '从 ' + beforeScore + ' 到 ' + after + '，轻轻动了 1 分。改变不需要剧烈，松动本身就是开始。';
      else if (diff === 0) msg = '分数没变，完全没关系。你愿意停下来面对它，已经是照顾自己的开始。有些情绪需要多一点时间，我随时在。';
      else msg = '分数降了一点，这说明它还在用力。如果这种状态持续两周以上，认真考虑找心理咨询师聊聊——这和感冒看医生一样正常。热线 12356 也随时在。';
      c.querySelector('#af-result').textContent = msg;
      c.querySelector('#af-done').style.display = 'none';
      var again = el('button', 'mind-again', '再梳理一次');
      again.addEventListener('click', reset);
      c.appendChild(again);
    });
  }

  function reset() {
    flowEl.innerHTML = '';
    var s1 = document.getElementById('mind-step1');
    s1.style.display = 'block';
    document.getElementById('mind-input').value = '';
    selectedMoods = [];
    document.querySelectorAll('#mood-chips button').forEach(function (b) { b.classList.remove('on'); });
    scrollToEl(s1);
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    flowEl = document.getElementById('mind-flow');
    if (!flowEl) return;
    var score = document.getElementById('mind-score');
    var scoreVal = document.getElementById('mind-score-val');
    score.addEventListener('input', function () { scoreVal.textContent = score.value; });
    document.querySelectorAll('#mood-chips button').forEach(function (b) {
      b.addEventListener('click', function () {
        b.classList.toggle('on');
        var m = b.getAttribute('data-mood');
        if (b.classList.contains('on')) selectedMoods.push(m);
        else selectedMoods = selectedMoods.filter(function (x) { return x !== m; });
      });
    });
    document.getElementById('mind-analyze').addEventListener('click', analyze);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
