/* ============================================================
 * 生活小规划师 · 对话引擎 v2
 * 领域知识库 + 上下文多轮 + 话术池（避免重复模板）
 * - 目标规划：识别领域（雅思/考研/健身/存钱/编程/英语…）给出具体拆解
 * - 决策分析：从原句抽取选项 A/B，围绕真实选项展开
 * - 思绪梳理：识别压力来源，多轮追问，记录真实情绪分值
 * - 记忆持久化：localStorage；可选 OpenAI 兼容大模型
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
  var store = {
    messages: LS.get('messages', []),
    goals: LS.get('goals', []),
    moods: LS.get('moods', []),
    state: LS.get('state', { flow: null, step: 0, data: {} }), // 多轮上下文
    api: LS.get('api', { url: '', key: '', model: 'deepseek-chat' })
  };
  function save(k) { LS.set(k, store[k]); }

  /* ---------- 工具 ---------- */
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function has(text, words) { return words.some(function (w) { return text.indexOf(w) >= 0; }); }

  /* ---------- 安全边界（最高优先级） ---------- */
  var CRISIS = ['自杀', '不想活', '自残', '自伤', '轻生', '结束生命', '活不下去'];
  var CRISIS_REPLY = '听到你这样说，我很担心你。你此刻的感受是真实的，也值得被认真对待。\n\n请允许我陪你做一件更重要的事——联系专业的支持：\n· 全国心理援助热线：12356\n· 北京心理危机研究与干预中心：010-82951332\n\n如果你正处于危险中，请立即拨打 120 或 110。你不需要独自扛过这一刻。';

  /* ============================================================
   * 通用场景知识库：聊天话题 → 全方位回答
   * 覆盖学习 / 工作 / 生活 / 健康 / 关系 / 个人成长
   * 每条规则：re(匹配正则) + echo(开场) + body(具体建议数组，随机挑3) + tiny(今日最小行动)
   * ============================================================ */
  var SCENE_RULES = [
    /* ---- 迷茫 / 无方向 ---- */
    {
      re: /迷茫|不知道做什么|不知道学什么|不知道干什么|没方向|没目标|很茫然|不知道自己要|未来|方向感/,
      key: '迷茫',
      echo: '这种「站在原地、哪条路都不像」的感觉，其实很多人都有——不是你不行，是暂时还没找到「钩子」。',
      body: [
        '别逼自己「想清楚再行动」，反过来：先做一个 7 天的微型实验，比如每天花 30 分钟试一个你有点好奇的事（写代码 / 画插画 / 研究营养学）。7 天后你自然知道哪个想继续。',
        '你现在的迷茫里，藏着一个线索：你会反复刷到哪类内容？或者身边哪个朋友在做的事让你心里有点痒？那就是你的「兴趣雷达」。',
        '把「找到人生目标」这个大问题换成：「我想成为一个什么样的人」？列 3 个形容词（比如「踏实」「自由」「能帮到人」），再倒推能靠近它的小事。',
        '迷茫不等于要立刻做决定。给自己一个「探索期」（3 个月内不必有结果），每周试一件以前没做过的事，做着做着，答案就冒出来了。'
      ],
      tiny: '今天花 10 分钟，搜一个你「有点好奇但一直没深想」的领域视频看看——不用学，就看看它是什么样的。'
    },

    /* ---- 时间管理 / 怎么安排 ---- */
    {
      re: /时间管理|怎么安排|安排一下|时间不够|忙不过来|效率|拖延|没效率|不知道先做|待办|清单|计划怎么/,
      key: '时间管理',
      echo: '时间管理的本质不是「挤更多时间」，而是「选哪些事值得占用你的时间」。',
      body: [
        '试试「三件事」法：每天只选 3 件最关键的事，完成就收工。其它事要么砍掉、要么等明天。大多数人忙碌是因为手里拿了 20 件事。',
        '用「艾森豪威尔矩阵」分四档：紧急又重要（立刻做）、重要不紧急（排时间做）、紧急不重要（委托/外包）、都不紧急不重要（直接删）。拿张纸，把你现在的 10 件事放进去。',
        '拖延的背后通常是「这件事太大」。把它砍到「荒谬的小」：比如「改方案」变成「打开文档，写第一句话」。身体一旦动起来，大脑就跟上了。',
        '晚上 10 分钟「日回顾」：今天做对了什么？卡住的是什么？明天最关键的一件事是什么？比花 2 小时写周计划有用。'
      ],
      tiny: '现在拿张纸，把你脑子里所有要做的事写出来——然后立刻把最不重要的 2 条划掉。'
    },

    /* ---- 学习 / 考试 ---- */
    {
      re: /学习|学不进去|效率低|不想学|读书|看书|备考|复习|考试|成绩|挂科|论文|期末|考研|考证|四六级|雅思|托福|专升本|中考|高考|背诵|记不住/,
      key: '学习',
      echo: '学不进去不是你笨，是方式可能没踩中大脑的开关——大脑喜欢「有反馈、有节奏、有意义」的学习。',
      body: [
        '试试「番茄工作法」：25 分钟专注 + 5 分钟完全离开（站起来走两步，别刷手机）。4 轮后休息 20 分钟。关键是：25 分钟里真的只做一件事。',
        '「主动回忆」比反复读有用 3 倍——合上书本，凭记忆复述这节讲了什么，想不起来再翻。这是最高效的记忆方式。',
        '把「我要学英语」换成「这周要能用英语说清楚我昨天做了什么」。目标越具体、越能立刻检验，大脑越愿意配合。',
        '学不进去的时候，先花 5 分钟「启动」：随便翻一页书、抄 3 个单词、敲 10 行代码。身体一旦开始动，心理阻力会突然变小。',
        '每天睡前 3 分钟过一遍今天学的东西，不用刻意记忆。大脑在睡眠时会巩固这些痕迹，比熬夜刷题效果好。'
      ],
      tiny: '现在选一个你在学的科目，用 25 分钟只做一件事（复习 / 做题 / 背诵三选一），然后按一下计时器。'
    },

    /* ---- 工作 / 职场 ---- */
    {
      re: /工作|上班|职场|老板|领导|同事|团队|项目|汇报|PPT|方案|加班|摸鱼|离职|跳槽|转行|被裁|裁员|绩效|述职/,
      key: '工作',
      echo: '工作占了我们一半的清醒时间，它值得被认真对待——但不是值得让它吞噬你。',
      body: [
        '「向上管理」的核心不是拍马屁，是让领导「不用猜你在干嘛」：每周一个 3 行周报（这周完成 / 下周计划 / 风险），领导的焦虑会少一半，你也会少很多临时救火。',
        '被批评了怎么办？先别急着反驳。问两个问题：「你觉得哪里没达到预期？」「你希望我怎么改进？」大多数时候，领导只是需要你「接住」他的情绪，而不是立刻辩论对错。',
        '想跳槽但不确定时机？用「三叶草模型」检查：兴趣（你喜欢做吗）、能力（你擅长做吗）、价值（有人为它付钱吗）。三个叶子都齐了，就是好时机。',
        '加班到崩溃时问自己：我现在做的事，半年后还重要吗？如果答案是否，那今天就先下班。工作永远做不完，但你的身体和情绪是有限的。',
        '和同事合不来？试试「职业礼貌」：保持专业、减少私下交集、只在工作话题上互动。不是所有人都要做朋友，职业距离能省很多内耗。'
      ],
      tiny: '今天和领导/同事做一次「清晰对齐」：用一句话说清楚「我手上现在有 X 件事，Y 最急，Z 我下午给你」。'
    },

    /* ---- 生活节奏 / 自律 / 习惯 ---- */
    {
      re: /自律|坚持不下来|习惯|养成|改不了|想做但|总是|没毅力|惰性|作息|早睡早起|规律|作息不规律/,
      key: '生活节奏',
      echo: '不是你没毅力，是你对「改变」的期待太猛了——大脑怕疼，小步才走得远。',
      body: [
        '「两分钟规则」：新习惯的前两分钟必须「荒谬地简单」。想跑步？前两分钟是「穿上运动鞋走到楼下」。想早睡？前两分钟是「把手机放另一个房间」。大脑愿意启动，后面才能接上。',
        '不要同时改 5 个习惯，一次只押 1 个。90% 的人自律失败，是因为同时开了太多战线，一个都没守住。',
        '给新习惯「绑定旧习惯」：比如「每天刷完牙就冥想 1 分钟」，让旧习惯成为新习惯的「提示」。这样就不用靠意志力想起它。',
        '允许「偶尔破功」。一周里有 1~2 天没做到没关系，关键是下一次能不能捡起来。真正的自律不是完美，是「不中断超过 2 天」。',
        '记录，但不要焦虑。每周只看一次完成率，低于 50% 就说明这个习惯设计得太难了——改小一点，别硬撑。'
      ],
      tiny: '选一个你想养成的习惯，把它砍到「两分钟版本」，明天只做这个最小版本。'
    },

    /* ---- 健康 / 饮食 / 睡眠 ---- */
    {
      re: /健康|饮食|吃饭|胃口|没胃口|吃不下|暴饮暴食|失眠|睡眠|睡不着|熬夜|黑眼圈|颈椎|腰酸|眼睛累|身体不舒服|头疼|胃痛|体重/,
      key: '健康',
      echo: '身体发出的信号都是真实的，它不会骗你。先停下来听一听它在说什么。',
      body: [
        '睡眠的关键不是「早睡」，是「固定起床时间」——哪怕前一晚只睡了 5 小时，早上也按时起，身体的生物钟才能校准过来。',
        '眼睛累了就闭眼 20 秒看远处（20-20-20 法则：每 20 分钟看 20 英尺外的物体 20 秒）。这个小动作能让眼压立刻降下来。',
        '吃饭狼吞虎咽会让大脑来不及收到「饱」的信号，一不小心就吃多。试试每口嚼 15 次，放下筷子再夹下一口。',
        '久坐 1 小时就起来站 2 分钟——不是为了运动，是让血液重新流动。腰椎和颈椎会在这 2 分钟里感激你。',
        '如果连续两周以上睡不好、吃不下，或者身体某部位持续不舒服，请去正规医院挂号——这不是「小问题忍忍就过」，身体在认真地提醒你。'
      ],
      tiny: '现在站起来活动 2 分钟，喝一杯水。就这么简单。'
    },

    /* ---- 关系 / 人际 ---- */
    {
      re: /关系|朋友|社交|人际|相处|沟通|吵架|冷战|分手|复合|暗恋|喜欢一个人|追对象|恋人|伴侣|对象|男朋友|女朋友|婚姻|婆媳|父母|家人|亲戚|同事关系|不合|矛盾|误会/,
      key: '关系',
      echo: '关系里最难的不是「怎么说对的话」，是「先接住对方的情绪」——情绪通了，道理才进得去。',
      body: [
        '沟通的「三明治结构」：正面肯定 → 想说的事 → 再一个正面肯定。比如「你平时特别靠谱（正面），但这次 deadline 确实有点紧张（想说的事），我相信下次我们能提前对齐（正面）」。比直接指责管用 10 倍。',
        '吵架后先别求「谁对谁错」，先求「我想和你一起解决这个问题」。把对立的「你 vs 我」变成「我们 vs 问题」，对方的防御会立刻降下来。',
        '有些关系到了该「放手」的时候：你每次和这个人聊完都很累、一直是你在主动、对方从不为你着想——这不是你不够好，是这段关系的营养已经耗尽了。',
        '和父母的矛盾，很多时候是「控制 vs 独立」的拉扯。试着说：「我知道你担心我，我自己也想了很久，我决定试试这条路，我为结果负责」——明确边界，同时表达感谢。',
        '想让朋友帮你一个忙？先「付出」再「请求」：先主动帮过对方一次，再开口。人情账户有余额，提款才不难。'
      ],
      tiny: '给一个很久没联系的朋友发一条「刚才突然想起你，最近怎么样」——不用等回复，发出去就行。'
    },

    /* ---- 周末 / 休闲 / 放松 ---- */
    {
      re: /周末|今天|今天做什么|明天|休息|放松|解压|娱乐|玩一下|出去玩|去哪|做什么好|无聊|不知道做什么|没事做|空闲|放假|国庆|五一|假期/,
      key: '休闲',
      echo: '不是每个休息日都要「充实地度过」——发呆、躺平、什么都不做，也是一种有价值的休息。',
      body: [
        '把周末分成「充电时间」和「留白时间」各一半。充电可以是学一个新东西，留白就是完全不安排。全充电会累，全留白会慌，各一半刚刚好。',
        '城市里很多「免费的快乐」：美术馆免费日、公园散步、旧书店淘书、江边吹风、听一场街头演出。不用花钱，却比刷短视频充实。',
        '如果你总觉得「周末没做什么」，试试「周末三件小事」：一个让身体动起来、一个让脑子动起来、一个让心灵动起来。每件 30 分钟就行。',
        '累到不想动的时候，就做「躺平」：关掉所有通知，什么都不做，让大脑真正「离线」。这不是浪费时间，是给系统升级。'
      ],
      tiny: '现在选一件「10 分钟就能让自己稍微开心一点」的小事：泡杯茶、听一首老歌、看一段搞笑视频——现在就做。'
    },

    /* ---- 自我成长 / 心态 ---- */
    {
      re: /心态|想通|想开|不开心|难过|开心|自信|自卑|焦虑|紧张|压力|累|心累|身心俱疲|对未来|对自己|讨厌自己|不喜欢自己|自我怀疑|内耗/,
      key: '自我成长',
      echo: '你对自己说的话，比任何别人对你说的话影响都大——温柔地对自己说话，是你能给自己最好的礼物。',
      body: [
        '下次自我批评的时候，试试把第二人称换成第三人称：「小远，你已经做得够多了，歇歇吧」。你会发现，对自己说的话突然变得不一样了。',
        '内耗的本质是「想做 A 又想做 B，但选了 A 又惦记 B」。试试「3 天规则」：选一个方向，坚持 3 天不回头。3 天后你就知道要不要调整。',
        '每天写 3 句话的「感恩练习」：今天谁帮了我？今天什么事做得不错？今天让我微笑的一件小事？坚持两周，你会发现大脑开始自动「搜好事」。',
        '允许自己「不够好」。完美主义不是高标准，是害怕被评判的恐惧。试着做一件「不完美」的事，做完会发现——天没有塌下来。'
      ],
      tiny: '对自己说一句「你已经尽力了」——就一句，认真说。'
    },

    /* ---- 提问 / 咨询类（通用） ---- */
    {
      re: /怎么|如何|为什么|为啥|怎么办|可以吗|行不行|好不好|要不要|建议|推荐|选哪个|哪个好/,
      key: '提问',
      echo: '好问题本身就是思考的开始——你问的这个，我试着和你一起拆。',
      body: [
        '把你的问题再具体一点：是「什么时候」（时间）、「在哪里」（场景）、还是「怎么做」（方法）？越具体的问题，回答才能越有针对性。',
        '说说你现在掌握的信息和已在考虑的选项？我不替你做决定，但可以帮你把每个选项的利弊摊开看清楚。',
        '这件事里你最在意的是什么？（结果、感受、代价、还是别人的看法？）明确了优先级，答案会自己浮出来。'
      ],
      tiny: '用一句话把你的问题写下来（比如「我要不要换工作？」），然后在后面加一句「因为……」。'
    }
  ];

  /* 根据关键词匹配最相关的场景（多关键词叠加时选最高权重的） */
  function matchScene(text) {
    var scores = {};
    // 关键词权重表（命中则加分）
    var KW = {
      // 学习 3
      '学习': 3, '学': 2, '书': 2, '考试': 3, '备考': 3, '复习': 3, '成绩': 2, '背': 2,
      // 工作 3
      '工作': 3, '上班': 3, '职场': 3, '老板': 2, '同事': 2, '汇报': 2, '项目': 2, '加班': 2, '离职': 3,
      // 健康 3
      '睡': 3, '失眠': 3, '吃': 2, '身体': 3, '累': 2, '疼': 2, '眼睛': 2,
      // 情绪 / 心态 3
      '难过': 3, '焦虑': 3, '压力': 3, '烦': 2, '低落': 2, 'emo': 3, '崩溃': 3, '不开心': 3,
      // 关系 3
      '朋友': 2, '对象': 2, '分': 2, '爸妈': 2, '父母': 2, '吵架': 3, '关系': 2, '恋': 2,
      // 生活
      '周末': 2, '今天': 2, '休息': 2, '玩': 1, '放松': 2, '无聊': 2, '空闲': 2, '放假': 2,
      // 时间 / 自律
      '时间': 2, '安排': 2, '管理': 2, '拖延': 3, '效率': 2, '计划': 2, '自律': 3, '坚持': 3,
      // 迷茫
      '迷茫': 3, '不知道': 2, '方向': 2, '未来': 1
    };
    for (var k in KW) { if (text.indexOf(k) >= 0) scores[k] = KW[k]; }
    // 优先精确匹配 SCENE_RULES 的正则
    var sceneHit = null, bestScore = 0;
    for (var i = 0; i < SCENE_RULES.length; i++) {
      if (SCENE_RULES[i].re.test(text)) {
        // 按 body 数组长度 + 关键词匹配打分
        var score = SCENE_RULES[i].body.length;
        for (var kw in KW) { if (text.indexOf(kw) >= 0 && SCENE_RULES[i].key.indexOf(kw[0]) >= 0) score++; }
        if (score > bestScore) { bestScore = score; sceneHit = SCENE_RULES[i]; }
      }
    }
    return sceneHit;
  }

  /* 生成场景化回复 */
  function sceneReply(text) {
    var scene = matchScene(text);
    if (!scene) return null;
    // 随机挑 3 条 body 建议
    var body = scene.body.slice().sort(function () { return Math.random() - .5; }).slice(0, 3);
    var opener = pick([
      scene.echo,
      '收到，关于「' + scene.key + '」这件事，我来和你具体聊聊。',
      '好，我们聚焦「' + scene.key + '」这个点，不泛谈。'
    ]);
    var reply = opener + '\n\n' + body.map(function (b, i) { return (i + 1) + '. ' + b; }).join('\n\n');
    if (scene.tiny) reply += '\n\n今天的最小行动：' + scene.tiny;
    // 关联已有目标
    var follow = continueGoalReply();
    if (follow) reply += '\n\n' + follow;
    return reply;
  }

  /* ============================================================
   * 目标领域知识库：每领域给出具体的阶段内容与今日第一步
   * ============================================================ */
  var GOAL_DOMAINS = [
    {
      re: /雅思|ielts/i, name: '雅思备考',
      stages: [
        { t: '摸底与词汇筑基', d: '做 1 套真题摸底（剑雅最新一本），记录四科弱项；每天 40 个核心词 + 精听 20 分钟，先让耳朵和眼睛适应。' },
        { t: '分科突破', d: '听力：精听+听写交替；阅读：限时训练+错题归类；写作：每周 2 篇对照范文改；口语：按当季题库录音自评。每周日做 1 次小模考。' },
        { t: '全科模考冲刺', d: '隔天 1 套完整模考，严格计时；建立错题本只看不加新题；口语找搭档或自录，考前一周减量保状态。' }
      ],
      first: '今天先用 20 分钟找一套剑雅真题（或在线模考），只做听力和阅读各一个 section，看看自己在哪一档——把分数告诉我，我帮你校准目标。'
    },
    {
      re: /考研|研究生/ , name: '考研备考',
      stages: [
        { t: '信息与基础阶段', d: '确定目标院校与专业，找齐参考书和真题；数学/英语先过第一轮基础，每天保证 3 小时有效学习。' },
        { t: '强化刷题阶段', d: '数学按题型刷真题，英语阅读逐篇精翻，专业课开始背诵框架；每周复盘一次进度，落后就砍掉低优先级资料。' },
        { t: '真题模拟阶段', d: '整套真题限时模拟，政治集中背诵，专业课按框架默写自测；最后两周只看错题和笔记。' }
      ],
      first: '今天先做一件事：写下目标院校 + 专业 + 考试科目（比如「XX大学 计算机 数一英一」），发给我，我帮你算每科每周该投多少时间。'
    },
    {
      re: /四六级|六级|四级|英语/ , name: '英语提升',
      stages: [
        { t: '语感恢复', d: '每天 30 个高频词 + 15 分钟精听（真题或播客），通勤时间泛听磨耳朵。' },
        { t: '分项训练', d: '阅读隔天 2 篇限时，写作每周 1 篇仿写，翻译积累 50 个常用表达；错题当天订正。' },
        { t: '套题演练', d: '每周 2 套真题限时，分析错题类型；考前一周只看错题本和高频词。' }
      ],
      first: '今天先测一下词汇量（任意 App 都可以），把大概数字告诉我，我帮你定每天背多少才不至于三天放弃。'
    },
    {
      re: /减肥|减脂|瘦身|体重/ , name: '减脂计划',
      stages: [
        { t: '习惯建立', d: '不节食，先做到：每餐七分饱、戒掉含糖饮料、每天走满 6000 步；记录体重但不焦虑波动。' },
        { t: '结构优化', d: '蛋白质提到每餐一掌心，主食换一半粗粮；每周 3 次 30 分钟有氧 + 2 次力量（深蹲、俯卧撑即可）。' },
        { t: '巩固维持', d: '找到能长期接受的饮食节奏，每周允许 1 次自由餐；体重进入目标区间后转为每月监测。' }
      ],
      first: '今天先记录三样东西：现在的体重、今天吃了什么、走了多少步。不用改，先看清楚现状，明天我们再动第一刀。'
    },
    {
      re: /健身|增肌|跑步|运动/ , name: '运动习惯',
      stages: [
        { t: '启动期', d: '每周 3 次、每次 20~30 分钟低强度（快走/慢跑/跟练视频），目标只是「完成」，不追求强度。' },
        { t: '进阶期', d: '每次 40 分钟，加入基础力量动作；记录每次内容，微微超过上周即可。' },
        { t: '稳定期', d: '固定到每周的具体日程里，形成不需要意志力的节奏；每月测一次体能小指标。' }
      ],
      first: '今天只做 10 分钟：下楼快走或者跟一段拉伸视频。做完告诉我感受，我们把第一次正式训练排到明天。'
    },
    {
      re: /存钱|攒钱|储蓄|理财/ , name: '储蓄计划',
      stages: [
        { t: '看清现金流', d: '连续记账 2 周，把支出分成「必要 / 需要 / 想要」三档；先不削减，只记录。' },
        { t: '建立储蓄管道', d: '发薪日先转走固定比例（建议 20% 起）到单独账户；砍掉「想要」档里频次最低的订阅。' },
        { t: '加速与缓冲', d: '建立 3~6 个月生活费的应急金；之后再考虑低风险投资，应急金不动。' }
      ],
      first: '今天先算一个数：你每月固定支出大约多少？告诉我数字，我帮你算合理的月储蓄额和达成时间。'
    },
    {
      re: /编程|代码|python|java|前端|后端|开发/ , name: '编程学习',
      stages: [
        { t: '语法与手感', d: '每天 1 小时：跟教程敲代码（不是看），每学完一节就改参数试效果；周末做一个 50 行以内的小练习。' },
        { t: '小项目驱动', d: '做一个自己用得上的小工具（记账脚本/待办清单/爬虫），卡住就查文档，把踩坑记下来。' },
        { t: '体系化补齐', d: '补数据结构与调试能力，读一遍自己项目代码重构；开始看开源项目的 README 和小模块源码。' }
      ],
      first: '今天先装好开发环境（编辑器 + 运行环境），跑通一个「Hello World」。卡在哪一步直接发给我。'
    },
    {
      re: /读|书|阅读/ , name: '阅读计划',
      stages: [
        { t: '重启阅读习惯', d: '每天睡前 20 分钟纸质书或墨水屏，手机放另一个房间；从薄的书开始，先体验读完一本的成就感。' },
        { t: '主题阅读', d: '围绕一个你关心的主题选 3 本书，边读边记 3 句话笔记：作者观点 / 我同意的 / 我质疑的。' },
        { t: '输出沉淀', d: '每读完一本写 200 字总结发给我或存备忘录；把能用的一个观点这周就用一次。' }
      ],
      first: '今天选一本你「有点想看但一直没看」的书，只读 10 页。把书名告诉我，我帮你排一个月的阅读节奏。'
    }
  ];
  var GOAL_DEFAULT = {
    name: '目标拆解',
    stages: [
      { t: '摸清现状', d: '用 2~3 天收集信息：做成这件事需要什么资源、大概路径、别人踩过的坑；每天投入 30 分钟建立最小行动。' },
      { t: '系统推进', d: '把大目标切成以周为单位的小目标，每周只聚焦 1~2 件关键事；每周日复盘，完成率低于 60% 就降难度。' },
      { t: '冲刺收尾', d: '临近截止逐步减少新内容，专注复盘和查漏补缺；最后一周保护状态，不再加量。' }
    ],
    first: '今天先回答我一个问题：这件事做到什么程度，你会对自己说「够了，我做到了」？把那个画面描述给我，我们一起倒推第一步。'
  };

  function goalReply(text) {
    var days = 30, m;
    if ((m = text.match(/(\d+)\s*个?月/))) days = parseInt(m[1], 10) * 30;
    else if ((m = text.match(/(\d+)\s*周/))) days = parseInt(m[1], 10) * 7;
    else if ((m = text.match(/(\d+)\s*天/))) days = parseInt(m[1], 10);
    else if (text.indexOf('半年') >= 0) days = 180;
    else if (text.indexOf('一年') >= 0) days = 365;

    var domain = GOAL_DOMAINS.find(function (d) { return d.re.test(text); }) || GOAL_DEFAULT;
    var p1 = Math.max(3, Math.round(days * 0.3)), p2 = Math.max(3, Math.round(days * 0.5)), p3 = Math.max(2, days - p1 - p2);
    var spans = [p1, p2, p3];

    var goal = {
      title: text.replace(/[。！？!?.，,]/g, '').slice(0, 24),
      domain: domain.name, days: days, ts: Date.now(),
      milestones: domain.stages.map(function (s, i) { return { name: s.t, desc: s.d, days: spans[i] }; })
    };
    store.goals.unshift(goal); if (store.goals.length > 5) store.goals.pop();
    save('goals'); syncGoalPage(goal);
    store.state = { flow: 'goal', step: 1, data: { title: goal.title } }; save('state');

    var opener = pick([
      '「' + goal.title + '」，好目标——够具体，就能拆。',
      '收到。这件事我陪你一起拆，先把它从「一座山」变成「几段台阶」。',
      '这个方向值得做。我们不求快，求每天都在往前走。'
    ]);
    return opener + '\n\n按' + domain.name + '的路子，约 ' + days + ' 天分三段：\n\n' +
      goal.milestones.map(function (ms, i) {
        return (i + 1) + '. ' + ms.name + '（约 ' + ms.days + ' 天）\n　' + ms.desc;
      }).join('\n\n') +
      '\n\n今天的第一步：' + domain.first +
      '\n\n目标已存进「我的目标」，每天打卡会自动更新进度。';
  }
  function syncGoalPage(goal) {
    var hero = document.querySelector('#page-plan .goal-hero h3');
    if (hero) hero.textContent = goal.title;
    var cd = document.querySelector('#page-plan .countdown b');
    if (cd) cd.textContent = goal.days;
    var meta = document.querySelector('#page-plan .gh-meta');
    if (meta) meta.textContent = '目标类型：' + goal.domain + ' · 由对话生成';
  }

  /* ============================================================
   * 决策分析：从原句抽取真实选项
   * ============================================================ */
  function parseOptions(text) {
    var m = text.match(/(?:是)?(.{1,15}?)\s*还是\s*(.{1,15}?)(?:[，,。?？！!呢吧]|$)/);
    if (m) return [m[1].trim(), m[2].trim()];
    m = text.match(/要不要(.{1,15}?)(?:[，,。?？！!]|$)/);
    if (m) return [m[1].trim(), '维持现状'];
    m = text.match(/该不该(.{1,15}?)(?:[，,。?？！!]|$)/);
    if (m) return [m[1].trim(), '先不动'];
    return null;
  }
  var DECISION_DIMS = [
    { k: '成长', q: '哪个选项能让你在一年后有明显的变化？' },
    { k: '代价', q: '哪个选项的「最坏结果」你更能承受？' },
    { k: '可逆性', q: '如果选错了，哪个更容易回头？' },
    { k: '心动', q: '抛掉所有理性分析，你的身体更想去哪个？' }
  ];
  function decisionReply(text) {
    var opts = parseOptions(text);
    store.state = { flow: 'decision', step: 1, data: { options: opts } }; save('state');
    var opener = pick([
      '纠结说明两个选项里都有你在乎的东西，这不是坏事。',
      '先别急着选。我们把它摊开看清楚，答案往往自己就浮出来了。',
      '这种反复想的感觉我懂。来，我们换个方式看这件事。'
    ]);
    if (!opts) {
      return opener + '\n\n告诉我你在纠结的两个具体选项，格式随意，比如「留在现在的公司 还是 去那家新公司」，或者「要不要搬出去住」。我按你在意的维度帮你拆开。';
    }
    var a = opts[0], b = opts[1];
    var dims = DECISION_DIMS.slice().sort(function () { return Math.random() - .5; }).slice(0, 3);
    return opener + '\n\n我听到的两个选项是：\nA ·「' + a + '」\nB ·「' + b + '」\n\n' +
      '先给你一个快速画像：\n' +
      '· 选 A「' + a + '」：你在推动变化，代价是面对未知；\n' +
      '· 选 B「' + b + '」：你在保护已有的稳定，代价是现在的问题可能继续。\n\n' +
      '接下来用三个维度过一遍（凭直觉回答就好）：\n' +
      dims.map(function (d, i) { return (i + 1) + '. ' + d.k + '——' + d.q; }).join('\n') +
      '\n\n把你的答案告诉我（哪怕只说「A、A、B」），我帮你看出倾向。也可以去「帮我选」页面拖权重滑块，看量化结果。';
  }

  /* ============================================================
   * 思绪梳理：识别压力来源 + 多轮
   * ============================================================ */
  var EMOTION_CAUSES = [
    { re: /工作|加班|老板|同事|裁员|绩效|职场/, key: '工作',
      echo: '工作上的事最容易缠在脑子里，因为它和「自我价值」绑得太紧。',
      act: '今晚先做个小动作：把明天最重要的 1 件事写在纸上，其余的先不碰。工作永远做不完，但今晚的你可以先下班。' },
    { re: /感情|对象|男朋友|女朋友|分手|吵架|喜欢|暗恋|婚姻/, key: '感情',
      echo: '关系里的事没有标准答案，所以才会反复想——你不是想太多，是在乎。',
      act: '试着把想对 TA 说但没说出口的话，写在备忘录里（不用发出去）。写的过程本身就是梳理。' },
    { re: /考试|成绩|学习|挂科|论文|毕业|学业/, key: '学业',
      echo: '学业压力最磨人的是「努力了但看不到即时回报」，这种悬空感很正常。',
      act: '把担心的事分成两列：「我能影响的」（复习节奏、求助老师）和「我影响不了的」（题目难度、别人进度）。今晚只碰第一列。' },
    { re: /父母|家庭|家人|妈|爸|亲戚/, key: '家庭',
      echo: '家庭的事最难处理，因为我们没法像对待外人那样保持距离。',
      act: '先给自己划一个心理边界：这件事里属于「我的责任」的部分是什么，属于「他们的课题」的部分是什么。分清了，心就轻一半。' },
    { re: /钱|经济|房租|工资|负债|存款/, key: '经济',
      echo: '钱的焦虑背后是安全感的焦虑，这个感受非常真实，不丢人。',
      act: '今晚只算一笔账：每月固定进、固定出各是多少。看清楚数字，焦虑往往会从「一团雾」变成「一个可以解决的问题」。' },
    { re: /睡不着|失眠|熬夜|睡眠/, key: '睡眠',
      echo: '深夜想太多，往往是白天没给情绪留出口，它们只能趁安静涌上来。',
      act: '现在试试 4-7-8 呼吸：吸气 4 秒、屏息 7 秒、呼气 8 秒，做 3 轮。然后把脑子里盘旋的事用一句话发给我，说出来了，脑子就不用一直替你想了。' }
  ];
  function emotionReply(text, score) {
    var cause = EMOTION_CAUSES.find(function (c) { return c.re.test(text); });
    var mood = { score: score || 3, note: text.slice(0, 40), ts: Date.now() };
    store.moods.push(mood); if (store.moods.length > 60) store.moods.shift();
    save('moods');
    store.state = { flow: 'emotion', step: 1, data: { cause: cause ? cause.key : null } }; save('state');

    var opener = pick([
      '先停一下，深呼吸。愿意说出来，就已经是往前迈了一步。',
      '抱抱你。这段时间确实不容易。',
      '我听到了。先不急着解决什么，我们先让心落地。'
    ]);
    if (!cause) {
      return opener + '\n\n能和我说说具体是什么事让你有这种感觉吗？是工作、关系、学业，还是说不上来的一团乱？\n\n如果给现在的状态打个分（1 分很糟，10 分很好），你会打几分？';
    }
    return opener + '\n\n' + cause.echo + '\n\n' + cause.act +
      '\n\n如果愿意，给现在的状态打个分（1~10），告诉我数字就行。这次记录已存进你的情绪曲线（仅你可见）。';
  }
  function emotionFollowup(text) {
    var m = text.match(/([1-9]|10)\s*分?/);
    if (m) {
      var s = parseInt(m[1], 10);
      store.moods.push({ score: s, note: '自评', ts: Date.now() }); save('moods');
      store.state = { flow: 'emotion', step: 2, data: { score: s } }; save('state');
      if (s <= 3) return s + ' 分，真的挺低的，辛苦了。我们先不处理「整件事」，只照顾「现在的你」：\n\n· 此刻身体有什么感觉？（紧、沉、还是麻）\n· 今天有没有哪怕 5 分钟是稍微轻松的？\n\n回答哪个都行。如果这种状态持续两周以上，认真考虑找心理咨询师聊聊——这和感冒了看医生一样正常。热线 12356 也随时在。';
      if (s <= 6) return s + ' 分，在中间偏下的位置——有点撑，但还没有被淹没。\n\n我们找找那个「拉住你」的东西：如果明天醒来这件事有了一点点好转，你最先注意到的会是什么小变化？';
      return s + ' 分，状态还不错嘛。那我们把这份好状态用起来：这件事里你觉得自己处理得还不错的部分是什么？把它记住，下次低落时它是你的证据。';
    }
    store.state = { flow: null, step: 0, data: {} }; save('state');
    return pick([
      '谢谢你愿意说这些。我把它拆一下：\n\n· 事实部分：' + text.slice(0, 20) + '——这是已经发生的，改不了，但可以应对；\n· 你的感受：值得被承认，不用急着压下去。\n\n今晚你能做的最小一步是什么？哪怕只是「好好吃一顿饭」。',
      '听下来，这件事里最让你难受的是哪个瞬间？我们聚焦那一个点，而不是整团乱麻。',
      '我陪着你理：这件事可以分成「能控制的」和「不能控制的」。你觉得哪部分占得更多？'
    ]);
  }

  /* ============================================================
   * 计算 / 倒计时
   * ============================================================ */
  function calcReply(text) {
    var expr = text.replace(/×/g, '*').replace(/÷/g, '/').replace(/[（）]/g, function (c) { return c === '（' ? '(' : ')'; }).replace(/\s/g, '');
    if (!/^[\d+\-*/.()]+$/.test(expr)) return null;
    try {
      var val = Function('"use strict";return (' + expr + ')')();
      if (typeof val !== 'number' || !isFinite(val)) throw 0;
      var r = Math.round(val * 10000) / 10000;
      return pick([
        '算好了：' + expr + ' = ' + r,
        expr + ' = ' + r + '。',
        '结果是 ' + r + '（' + expr + '）。'
      ]) + '\n\n还要算别的吗？占比、日均、换算都行。';
    } catch (e) { return '这个算式我没看懂，试试「128*3+45」这样的形式。'; }
  }
  function countdownReply(text) {
    var m = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/);
    if (!m) return '告诉我具体日期就行，比如「离 12 月 20 日还有几天」。';
    var now = new Date(), y = now.getFullYear();
    var target = new Date(y, +m[1] - 1, +m[2]);
    if (target < now) target = new Date(y + 1, +m[1] - 1, +m[2]);
    var d = Math.ceil((target - now) / 86400000);
    var weeks = Math.floor(d / 7);
    return '距离 ' + (+m[1]) + ' 月 ' + (+m[2]) + ' 日还有 ' + d + ' 天' + (weeks ? '（约 ' + weeks + ' 周）' : '') + '。\n\n' +
      (d > 14 ? '时间还够做一个三阶段计划，要把这个日子设成目标吗？' : '时间有点紧了，要不要我帮你排一个「只看重点」的冲刺计划？');
  }

  /* ============================================================
   * 通用话术池
   * ============================================================ */
  function greetReply() {
    var h = new Date().getHours();
    var when = h < 6 ? '夜深了' : h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好';
    var line = pick([
      '今天想先聊点什么？',
      '我在，说吧。',
      '今天过得怎么样？'
    ]);
    var hint = h >= 23 || h < 6
      ? '\n\n这么晚还没睡，是有什么事在脑子里转吗？也可以说给我听。'
      : '\n\n可以直接说事，比如「我要 3 个月后考雅思」「在纠结要不要换工作」「最近总睡不着」。';
    return when + '，' + line + hint;
  }
  function thanksReply() {
    return pick([
      '不客气，这是你自己迈出的步子。需要调整计划随时来。',
      '应该的。有进展记得告诉我，我帮你记着。',
      '去吧，把今天的小任务完成就是最好的感谢。'
    ]);
  }
  function continueGoalReply() {
    var g = store.goals[0];
    if (!g) return null;
    var dayN = Math.min(g.days, Math.max(1, Math.ceil((Date.now() - g.ts) / 86400000)));
    return pick([
      '顺便看了下你的目标「' + g.title + '」，今天是第 ' + dayN + ' 天。今天的小任务完成了吗？',
      '对了，「' + g.title + '」进行到第 ' + dayN + ' 天了。遇到卡点了吗？有的话我们现场调计划。',
      '你的「' + g.title + '」还在推进中（第 ' + dayN + ' 天）。想汇报进度还是想调整节奏？'
    ]);
  }
  /* 从用户原话提取核心短语（去掉语气词/标点/冗余）用于在回复开头复述 */
  function extractCore(text) {
    var s = text.replace(/[，。！？!?,.\s呀啊呢吧了的就还也都反正其实]*/g, '').trim();
    if (s.length > 14) s = s.slice(0, 14);
    return s || text.slice(0, 10);
  }
  function fallbackReply(text) {
    // 优先尝试场景化回复（学习/工作/生活/健康/关系/迷茫…）
    var scene = sceneReply(text);
    if (scene) {
      // 在场景回复前加一个"复述你说的这件事"的前缀，让模板也能回应具体内容
      var core = extractCore(text);
      var prefix = '你说的是「' + core + '」这件事——\n\n';
      return prefix + scene;
    }
    // 再尝试从用户输入里抓一个关键词做具体追问
    var kw = text.replace(/[，。！？!?,.\s呀啊呢吧了]*/g, '').slice(0, 8);
    var follow = continueGoalReply();
    var openers = [
      '我在听。关于「' + kw + '」，能多展开一点吗？',
      '「' + kw + '」——这件事现在是卡在哪个环节？',
      '嗯，「' + kw + '」。你是想让我帮你理思路、做计划，还是只想先有人听你说？'
    ];
    var body = pick(openers) + '\n\n我比较擅长的几类：拆目标做计划、在选项间帮你权衡、陪你梳理情绪、快速计算、全方位聊聊学习/工作/生活/健康/关系。';
    return follow ? body + '\n\n' + follow : body;
  }

  /* ---------- 意图识别 ---------- */
  function detectIntent(text) {
    if (has(text, CRISIS)) return 'crisis';
    if (/(考|备考|学会|减肥|健身|跑步|存钱|攒钱|目标|计划|规划|雅思|托福|考研|证书|读书)/.test(text) &&
        /(\d+\s*(天|周|个月|月)|半年|一年|每天)/.test(text)) return 'goal';
    if (/(要不要|纠结|犹豫|还是|该不该|权衡|怎么选)/.test(text)) return 'decision';
    if (/(睡不着|失眠|焦虑|烦|压力大|心累|难过|低落|emo|崩溃|不安|紧张|内耗|想哭|孤独)/.test(text)) return 'emotion';
    if (/^[\d\s+\-*/×÷.()（）]+$/.test(text) && /\d/.test(text)) return 'calc';
    if (/(还有几天|倒计时|多少天|多久到)/.test(text)) return 'countdown';
    if (/^(你好|hi|hello|在吗|早上好|晚上好|嗨|喂)/i.test(text.trim())) return 'greet';
    if (/(谢谢|感谢|辛苦)/.test(text)) return 'thanks';
    return 'chat';
  }

  function localReply(text) {
    // 多轮上下文优先
    if (store.state.flow === 'emotion' && store.state.step >= 1) return emotionFollowup(text);
    if (store.state.flow === 'decision' && store.state.step >= 1 && /^[ABab，,\s]{1,5}$/.test(text.trim())) {
      var letters = text.toUpperCase().replace(/[^AB]/g, '').split('');
      var a = letters.filter(function (x) { return x === 'A'; }).length, b = letters.length - a;
      store.state = { flow: null, step: 0, data: {} }; save('state');
      if (a === b) return '你的直觉打了个平手——这通常意味着：两个选项其实都能走，差别在于你想成为哪种人。\n\n换个终极问题：哪个选项更像「你想成为的那个自己」会做的决定？';
      return (a > b ? 'A' : 'B') + ' 占了上风（' + Math.max(a, b) + ' : ' + Math.min(a, b) + '）。你的直觉已经有倾向了。\n\n建议：给「' + (a > b ? 'A' : 'B') + '」设一个 72 小时冷静期，这期间不做任何动作。如果 3 天后你想起它时心里是踏实的，那就是答案。';
    }

    switch (detectIntent(text)) {
      case 'crisis': return CRISIS_REPLY;
      case 'goal': return goalReply(text);
      case 'decision': return decisionReply(text);
      case 'emotion': return emotionReply(text);
      case 'calc': return calcReply(text) || fallbackReply(text);
      case 'countdown': return countdownReply(text);
      case 'greet': return greetReply();
      case 'thanks': return thanksReply();
      default: return fallbackReply(text);
    }
  }

  /* ---------- 大模型（可选，OpenAI 兼容） ---------- */
  function apiReply(history) {
    var cfg = store.api;
    if (!cfg.url || !cfg.key) return Promise.reject(new Error('no-api'));
    var lastUserMsg = '';
    for (var i = history.length - 1; i >= 0; i--) { if (history[i].role === 'user') { lastUserMsg = history[i].text; break; } }
    var sceneHint = '';
    if (lastUserMsg) {
      var s = matchScene(lastUserMsg);
      if (s) sceneHint = '\n6. 当前话题疑似属于「' + s.key + '」场景，请针对用户原话里提到的具体情境（不要漏原话里的细节）给出针对性回答，不要套通用模板。';
    }
    var sys = '你是「生活小规划师」，温柔但专业的规划伙伴。规则：' +
      '1. 针对用户说的具体内容回答，不要空泛套话——用户原话里的关键词和细节必须在你的回答里得到回应；' +
      '2. 回答有结构但口语化，适当用换行和小标题；' +
      '3. 目标类问题主动拆阶段并追问时间投入；决策类帮用户列维度权衡；情绪类先共情再引导；' +
      '4. 不替代专业医疗/心理/法律意见；自伤倾向时优先给出心理援助热线 12356；' +
      '5. 用简体中文，单次回复控制在 350 字内。' + sceneHint;
    var msgs = [{ role: 'system', content: sys }].concat(
      history.slice(-12).map(function (m) { return { role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }; })
    );
    return fetch(cfg.url.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model || 'deepseek-chat', messages: msgs, temperature: 0.7 })
    }).then(function (r) {
      if (!r.ok) throw new Error('http-' + r.status);
      return r.json();
    }).then(function (j) {
      var t = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!t) throw new Error('empty');
      return t;
    });
  }

  /* ---------- UI ---------- */
  var AI_AVATAR = '<span class="ai-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0-6 6c0 1.6.6 2.6 1.4 3.6.9 1.1 1.6 1.8 1.6 3.4h6c0-1.6.7-2.3 1.6-3.4.8-1 1.4-2 1.4-3.6a6 6 0 0 0-6-6z"/></svg></span>';
  var css = document.createElement('style');
  css.textContent =
    '.typing-dots{display:inline-flex;gap:4px;padding:2px 0}' +
    '.typing-dots i{width:6px;height:6px;border-radius:50%;background:#8FB996;animation:td 1s infinite ease-in-out}' +
    '.typing-dots i:nth-child(2){animation-delay:.15s}.typing-dots i:nth-child(3){animation-delay:.3s}' +
    '@keyframes td{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}' +
    '.bubble{white-space:pre-wrap}' +
    '.api-cfg{padding:12px 4px 2px}' +
    '.api-cfg input{width:100%;margin:6px 0;padding:9px 12px;border:1px solid var(--line,#ECE6DC);border-radius:10px;font:inherit;font-size:13px;background:#fff}' +
    '.api-cfg .api-save{margin-top:4px;padding:8px 16px;border:none;border-radius:10px;background:#8FB996;color:#fff;font:inherit;font-size:13px;cursor:pointer}' +
    '.api-status{font-size:12px;color:#8A8178;margin-top:6px}';
  document.head.appendChild(css);

  function flowEl() { return document.getElementById('chat-flow'); }
  function scrollBottom() {
    var body = document.querySelector('#page-home .page-body');
    if (body) body.scrollTop = body.scrollHeight;
  }
  function addMsg(role, text, silent) {
    var flow = flowEl(); if (!flow) return;
    var div = document.createElement('div');
    div.className = 'msg' + (role === 'user' ? ' user' : '');
    div.innerHTML = (role === 'ai' ? AI_AVATAR : '') + '<div class="bubble ' + (role === 'ai' ? 'ai' : 'user-b') + '"></div>';
    div.querySelector('.bubble').textContent = text;
    flow.appendChild(div);
    scrollBottom();
    if (!silent) {
      store.messages.push({ role: role, text: text, ts: Date.now() });
      if (store.messages.length > 200) store.messages.splice(0, store.messages.length - 200);
      save('messages');
    }
  }
  function showTyping() {
    var flow = flowEl(); if (!flow) return null;
    var div = document.createElement('div');
    div.className = 'msg'; div.id = 'typing-row';
    div.innerHTML = AI_AVATAR + '<div class="bubble ai"><span class="typing-dots"><i></i><i></i><i></i></span></div>';
    flow.appendChild(div); scrollBottom();
    return div;
  }

  function send(text) {
    text = (text || '').trim();
    if (!text) return;
    var seed = document.getElementById('chat-seed');
    if (seed) seed.remove();
    addMsg('user', text);
    var typing = showTyping();
    var done = function (reply) { if (typing) typing.remove(); addMsg('ai', reply); };
    if (detectIntent(text) === 'crisis') { setTimeout(function () { done(CRISIS_REPLY); }, 600); return; }
    apiReply(store.messages).then(done, function () {
      setTimeout(function () { done(localReply(text)); }, 450 + Math.random() * 550);
    });
  }

  function bind() {
    var input = document.getElementById('chat-input');
    var btn = document.getElementById('chat-send');
    if (!input || !btn) return;
    btn.addEventListener('click', function () { send(input.value); input.value = ''; input.focus(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { send(input.value); input.value = ''; } });

    store.messages.forEach(function (m) { addMsg(m.role, m.text, true); });

    var h = new Date().getHours();
    var greet = document.querySelector('#page-home .page-header h2');
    if (greet) greet.textContent = (h < 6 ? '夜深了' : h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好') + '，小远';
    if (store.goals.length) syncGoalPage(store.goals[0]);

    var settingCard = document.querySelector('#page-me .card:last-of-type');
    if (settingCard && !settingCard.querySelector('.api-cfg')) {
      var box = document.createElement('div');
      box.className = 'api-cfg';
      box.innerHTML =
        '<div style="margin:10px -4px 6px;padding:10px 12px;border-radius:10px;background:rgba(143,185,150,.12);border:1px solid rgba(143,185,150,.35);font-size:12.5px;line-height:1.7;color:#35513C;">' +
          '<b>💡 让对话真正"听懂你"：</b>填一次 API Key，回答会从模板变成理解你具体说的话。推荐 <a href="https://platform.deepseek.com/" target="_blank" rel="noopener" style="color:#4F7057;text-decoration:underline;">DeepSeek</a>（中文好、便宜，1 块钱能用很久）。仅保存在你本机。' +
        '</div>' +
        '<div class="sr-label" style="font-weight:600">AI 接口配置</div>' +
        '<div class="sr-desc" style="margin-bottom:6px;">OpenAI 兼容，以下是推荐默认值（点下面按钮一键填入）</div>' +
        '<div style="display:flex;gap:6px;margin-bottom:4px;">' +
          '<button id="api-deepseek" type="button" style="flex:1;padding:7px 0;border:1px solid var(--sage,#8FB996);background:rgba(143,185,150,.1);color:#4F7057;border-radius:8px;font:inherit;font-size:12px;cursor:pointer;">一键填入 DeepSeek 默认值</button>' +
        '</div>' +
        '<input id="api-url" type="text" placeholder="接口地址">' +
        '<input id="api-key" type="password" placeholder="API Key（去 platform.deepseek.com 申请）">' +
        '<input id="api-model" type="text" placeholder="模型名">' +
        '<div style="display:flex;gap:6px;">' +
          '<button class="api-save" type="button">保存并启用</button>' +
          '<button id="api-clear" type="button" style="padding:8px 14px;border:1px solid var(--line,#ECE6DC);background:#fff;border-radius:10px;font:inherit;font-size:13px;color:var(--muted,#8A8178);cursor:pointer;">用本地应答</button>' +
        '</div>' +
        '<div class="api-status" id="api-status"></div>';
      settingCard.appendChild(box);
      var cfg = store.api;
      var urlIn = box.querySelector('#api-url'), keyIn = box.querySelector('#api-key'), modelIn = box.querySelector('#api-model');
      urlIn.value = cfg.url || '';
      keyIn.value = cfg.key || '';
      modelIn.value = cfg.model || '';
      var status = box.querySelector('#api-status');
      status.textContent = cfg.url && cfg.key ? '✅ 已启用大模型（' + cfg.model + '）' : '当前：本地智能应答（关键词匹配，配大模型后回答更智能）';
      box.querySelector('#api-deepseek').addEventListener('click', function () {
        urlIn.value = 'https://api.deepseek.com/v1';
        modelIn.value = 'deepseek-chat';
        if (!keyIn.value) keyIn.focus();
      });
      box.querySelector('.api-save').addEventListener('click', function () {
        store.api = { url: urlIn.value.trim(), key: keyIn.value.trim(), model: modelIn.value.trim() || 'deepseek-chat' };
        save('api');
        status.textContent = store.api.url && store.api.key ? '✅ 已启用大模型（' + store.api.model + '），对话现在会真正理解你的话了' : '⚠️ 地址或 Key 为空，保存但未启用，仍用本地应答';
      });
      box.querySelector('#api-clear').addEventListener('click', function () {
        store.api = { url: '', key: '', model: 'deepseek-chat' }; save('api');
        urlIn.value = ''; keyIn.value = ''; modelIn.value = '';
        status.textContent = '已切回本地智能应答';
      });
    }
  }

  window.lspSend = send;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
