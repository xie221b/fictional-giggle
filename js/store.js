/* ============================================================
 * 数据层 v2：localStorage 持久化 + 初始数据
 * ============================================================ */
(function () {
  const KEY = 'lifehub_state_v3';
  const APP_VERSION = '3.0.0';
  const LEGACY_KEYS = ['lifehub_state_v2', 'lifehub_state_v1'];

  function uid() {
    return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function todayStr(offsetDays) {
    const d = new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function monthStr() { return todayStr().slice(0, 7); }

  const CATS = {
    must: ['饮食', '水电房租', '固定交通', '固定学习', '其他'],
    hobby: ['美甲', '日本小杂物', '轻度代购', '烘焙原料', '逛街咖啡', '书籍', '其他'],
    street: ['Loverboy', 'Palace', 'Supreme', '其他']
  };

  const POOL_META = {
    must:   { name: '必须支出' },
    hobby:  { name: '轻度爱好' },
    street: { name: '潮牌基金' }
  };

  const TAGS = {
    sports: ['游泳'],
    art: ['国画', '美甲'],
    study: ['CC 会计', '英语口语'],
    life: ['烘焙', '假期/回家']
  };

  const TAG_LABEL = { emo: '[非必要情绪消费]', ship: '[国际运费分摊]', gacha: '[盲盒/扭蛋冲动支出]' };

  const DEFAULT_THEME = {
    preset: 'paper',
    custom: {}
  };

  const DEFAULT_BACKGROUND = { type: 'none', value: '', opacity: 0.15 };

  const DEFAULT_TAG_COLORS = {
    '游泳': '#2E8B7B', '国画': '#8A6D3B', '美甲': '#B06AB3', 'CC 会计': '#4A6FA5',
    '英语口语': '#4A6FA5', '烘焙': '#C68A2E', '假期/回家': '#6B5B95'
  };

  const DEFAULT_TAG_EMOJI = {
    '游泳': '🏊', '国画': '🎨', '美甲': '💅', 'CC 会计': '📖',
    '英语口语': '🗣️', '烘焙': '🥧', '假期/回家': '🧳'
  };

  const DEFAULT_CAT_COLORS = { sports: '#2E8B7B', art: '#B06AB3', study: '#4A6FA5', life: '#C68A2E' };

  const DEFAULT_PRIORITY = { p1: '#C0392B', p2: '#2E7D5B', p3: '#D9822B', p4: '#8A8A8E' };

  const DEFAULT_SYNC = { server: '', user: '', pass: '', file: 'lifehub.json', enabled: false, last: '' };

  const DEFAULT_COPY = {
    questions: `去消费主义|最近一次「买了但没带来快乐」的东西是什么？它想满足的其实是哪种需求？
人生|如果未来一年只允许自己专注三件事，你会选哪三件？为什么是它们？
审美|你的房间/桌面为什么会长成这样？它反映了你现在的生活状态吗？
人生|十年后回看现在，你最希望自己多做点什么、少做点什么？
情感|最近一段让你觉得「被认真对待」的关系瞬间是什么？你为对方做过同样的事吗？
去消费主义|「拥有」和「体验」，哪一种更接近你真正想要的快乐？
社会|如果没有人看见，你还会做现在做的这些事吗？
审美|你手机里保存的图片，暴露了你向往的哪种生活？
人生|过去一年你做过的决定里，哪个最像「自己」？哪个最不像？`,
    fillers: `就是
然后
那个
这个嘛
呃
嗯
就是说
其实吧
反正`,
    skeleton: `1) Topic Sentence —— I want to talk about {topic}.
2) My point —— What matters most to me is that ...
3) Reason —— Because it connects with ...
4) Takeaway —— So what I'll do next is ...`,
    media: `小红书：
萌物标题：治愈系萌物藏品 ｜ {name}的快乐磁场
萌物正文：{name}，第一眼就想带回家的那种。{detail}放在桌面上，每次抬头都能被可爱充电。它不是消费，是给自己的情绪养分 🧡
萌物标签：#轻松熊 #治愈系 #萌物收藏 #桌面布置 #情绪价值
烘焙标题：第一次做{name}就成功 ｜ 零失败配方
烘焙正文：{name}出炉啦！{detail}配方和步骤我都整理在首页/评论区，照着做基本不会翻车 ✨
烘焙标签：#烘焙 #烘焙日常 #在家做甜品 #治愈系美食
排期提示：周三/周日 20:00 是图文流量高峰
排期时间：20:00
抖音：
萌物标题：桌面治愈瞬间 ｜ {name}
萌物正文：工作间隙抬头看到它，心情立刻 +1。{detail}
萌物标签：#桌面布置 #萌物收藏 #治愈系
烘焙标题：零失败{name} ｜ 前 3 秒就被香到
烘焙正文：俯拍全流程，成品切开的那一刻是灵魂。{detail}
烘焙标签：#烘焙 #俯拍美食 #在家做甜品
排期提示：周五 19:30 晚高峰，前 3 秒放成品特写
排期时间：19:30
Threads：
萌物标题：今晚的小快乐 ｜ {name}
萌物正文：不贵，但每天都让我开心。{detail}这就是「用很少的钱买到很多情绪价值」。
萌物标签：#治愈系 #日常小确幸
烘焙标题：烤箱里的香气是最便宜的正能量
烘焙正文：今天烤了{name}，整个房间都是甜的。{detail}
烘焙标签：#烘焙日常 #自愈时刻
排期提示：Threads 走轻量高频，每晚 21:00 一条短文即可
排期时间：21:00`,
    speech: `direct：爸/妈，最近我在坚持{note}，算是正经的学习和生活投资，这个月花了 {amount}。能帮我报一点吗？不用全报～
probable：最近买了个{name}，日常真的用得上（做饭/居家都顺手），花了 {amount}。你们要是觉得可以，就帮我报销一下？不行也没关系～
self：这笔（{name} · {amount}）我自己承担，不报销，只是记在这里提醒自己。`,
    interceptTitle: '⚠️ 拦截提醒：先清库存',
    interceptBody: '你还有未拆封的存货没用完：{list}。无意识囤货是最容易的消费陷阱，建议先用完再考虑新的。',
    useupTips: `苹果|苹果派 / 苹果酱 / 肉桂烤苹果片（冷冻可存 3 个月）
淡奶油|打发后冷冻成奶油块，或做蛋挞液、奶油蘑菇汤
黄油|切小块冷冻，随用随取，也可做蒜香黄油
面粉|松饼、鸡蛋饼、蛋糕预拌粉
牛奶|煮奶茶、做酸奶、冻冰块配咖啡
鸡蛋|卤一锅茶叶蛋，冷藏可放一周
糖|做糖浆、焦糖酱，密封防潮可久放`,
    shoot: `小红书：超小桌面 + 纯色背景布 + 日落灯/柔光灯 · 俯视 45° 平铺 · 留白 60% · 统一色调，三张为一组。
抖音：俯拍特写 + 高颜值成品摆盘 · 步骤每段 ≤3 秒 · 烤箱门打开的瞬间是钩子 · 收尾展示切开面。`,
    ui: {
      heroTitle: '把日子过得明白',
      heroSub: '本月预算 ¥{budget} · 已花 ¥{spent} · 剩余 ¥{left}',
      pools: '预算池',
      pending: '待购冷静期',
      watch: '需要留意',
      week: '近 7 天安排',
      expiry: '临期食材',
      reimburse: '报销追踪',
      streak: '行动打卡',
      emptyPending: '没有待购项，很冷静 😌',
      emptyWatch: '一切正常，继续保持 ✨',
      emptyWeek: '近 7 天没有安排。',
      emptyExpiry: '没有临期食材。',
      emptyReimburse: '暂无待报销。',
      emptyStreak: '今天还没打卡，去「口语与思考」想一个问题、动一下。'
    }
  };

  function seed() {
    const now = Date.now();
    const HOUR = 3600 * 1000;
    const t = todayStr;
    return {
      settings: { monthlyBudget: 6000, pools: { must: 4000, hobby: 1000, street: 1000 } },
      theme: JSON.parse(JSON.stringify(DEFAULT_THEME)),
      background: JSON.parse(JSON.stringify(DEFAULT_BACKGROUND)),
      tagColors: JSON.parse(JSON.stringify(DEFAULT_TAG_COLORS)),
      tagEmoji: JSON.parse(JSON.stringify(DEFAULT_TAG_EMOJI)),
      catColors: JSON.parse(JSON.stringify(DEFAULT_CAT_COLORS)),
      priorityColors: JSON.parse(JSON.stringify(DEFAULT_PRIORITY)),
      sync: JSON.parse(JSON.stringify(DEFAULT_SYNC)),
      copy: JSON.parse(JSON.stringify(DEFAULT_COPY)),
      month: monthStr(),
      expenses: [
        { id: uid(), date: t(0), amount: 45.5, pool: 'must', cat: '饮食', note: '超市买菜', tag: '', reimb: '', source: 'manual' },
        { id: uid(), date: t(-1), amount: 128, pool: 'hobby', cat: '逛街咖啡', note: '和朋友的咖啡', tag: '', reimb: '', source: 'manual' },
        { id: uid(), date: t(-2), amount: 268, pool: 'hobby', cat: '美甲', note: '甲片', tag: 'emo', reimb: '', source: 'manual' },
        { id: uid(), date: t(-3), amount: 120, pool: 'hobby', cat: '书籍', note: '国画入门教材', tag: '', reimb: 'direct', source: 'manual' }
      ],
      pending: [
        {
          id: uid(), name: 'Loverboy 印花帽', price: 1680, source: '日代', url: '',
          addedAt: now, coolUntil: now + 24 * HOUR, status: 'cooling',
          checks: { xhs: false, xianyu: '', taobao: '' },
          shipping: { total: 0, items: 1 }
        },
        {
          id: uid(), name: '扭蛋小挂件', price: 30, source: '店铺', url: '',
          addedAt: now - 26 * HOUR, coolUntil: now - 2 * HOUR, status: 'cooling',
          checks: { xhs: false, xianyu: '', taobao: '' },
          shipping: { total: 0, items: 1 }
        }
      ],
      reimbursements: [
        { id: uid(), name: '国画入门教材', amount: 120, type: 'direct', status: 'pending', note: '兴趣爱好，学习投资', date: t(-3) },
        { id: uid(), name: '轻松熊披萨碗', amount: 89, type: 'probable', status: 'pending', note: '实用萌物/居家用品', date: t(-6) }
      ],
      skincareStock: [
        { id: uid(), name: '眼霜（大牌）', state: '未拆封' },
        { id: uid(), name: '精纯精华', state: '未拆封' },
        { id: uid(), name: 'CPB 面霜', state: '未拆封' },
        { id: uid(), name: '防晒', state: '已拆封' }
      ],
      recipes: [
        {
          id: uid(), title: '经典苹果派', source: '小红书', link: '', servings: 6,
          createdAt: todayStr(-12),
          ingredients: [
            { name: '苹果', amount: 4, unit: '个' },
            { name: '面粉', amount: 250, unit: '克' },
            { name: '黄油', amount: 120, unit: '克' },
            { name: '淡奶油', amount: 200, unit: '毫升' },
            { name: '糖', amount: 60, unit: '克' }
          ],
          steps: ['黄油切丁与面粉搓成沙状，加冰水成团冷藏 30 分钟', '苹果切块加糖炒软，倒入淡奶油收汁', '面团擀开铺入模具，填入苹果馅，盖上层派皮', '180 度烤 40 分钟至金黄'],
          equipment: ['苹果派模具', '烤箱', '擀面杖', '打蛋器', '煮锅'],
          note: '派皮冷藏后更好擀；下次糖减到 50g'
        },
        {
          id: uid(), title: '黄油曲奇', source: '抖音', link: '', servings: 4,
          createdAt: todayStr(-9),
          ingredients: [
            { name: '黄油', amount: 100, unit: '克' },
            { name: '面粉', amount: 150, unit: '克' },
            { name: '糖', amount: 50, unit: '克' },
            { name: '鸡蛋', amount: 1, unit: '个' }
          ],
          steps: ['黄油软化加糖打发至发白', '分次加入蛋液拌匀', '筛入面粉拌匀成团', '整形冷冻 20 分钟后切片，170 度烤 15 分钟'],
          equipment: ['烤箱', '打蛋器', '裱花袋'],
          note: ''
        },
        {
          id: uid(), title: '薄底披萨', source: '小红书', link: '', servings: 2,
          createdAt: todayStr(-6),
          ingredients: [
            { name: '高筋面粉', amount: 250, unit: '克' },
            { name: '水', amount: 160, unit: '毫升' },
            { name: '酵母', amount: 3, unit: '克' },
            { name: '盐', amount: 3, unit: '克' }
          ],
          steps: ['所有材料揉成光滑面团', '发酵至两倍大', '擀薄整形，铺料', '230 度烤 12 分钟'],
          equipment: ['烤箱', '披萨石', '擀面杖'],
          note: '厨师机可代替手揉，省力'
        }
      ],
      inventory: [
        { id: uid(), name: '苹果', qty: 8, unit: '个', expiry: t(2), cat: '水果' },
        { id: uid(), name: '面粉', qty: 1, unit: '袋', expiry: t(60), cat: '面粉糖类' },
        { id: uid(), name: '黄油', qty: 200, unit: '克', expiry: t(5), cat: '乳制品' },
        { id: uid(), name: '淡奶油', qty: 500, unit: '毫升', expiry: t(3), cat: '乳制品' },
        { id: uid(), name: '鸡蛋', qty: 6, unit: '个', expiry: t(10), cat: '其他' },
        { id: uid(), name: '糖', qty: 1, unit: '袋', expiry: t(120), cat: '面粉糖类' },
        { id: uid(), name: '牛奶', qty: 1, unit: '盒', expiry: t(-1), cat: '乳制品' }
      ],
      equipment: [
        { id: uid(), name: '烤箱', owned: true, price: 0, for: '通用' },
        { id: uid(), name: '打蛋器', owned: true, price: 0, for: '通用' },
        { id: uid(), name: '擀面杖', owned: true, price: 0, for: '通用' },
        { id: uid(), name: '苹果派模具', owned: false, price: 59, for: '派/挞' },
        { id: uid(), name: '蛋糕模具', owned: false, price: 79, for: '蛋糕' },
        { id: uid(), name: '披萨石', owned: false, price: 129, for: '披萨/吐司' },
        { id: uid(), name: '厨师机', owned: false, price: 1699, for: '披萨/吐司', pro: true }
      ],
      tasks: [
        { id: uid(), title: '游泳', date: t(1), time: '18:30', cat: 'sports', tag: '游泳', place: '游泳馆', note: '带泳镜', remind: 30, done: false, cost: 0, pool: 'hobby', priority: 'p2' },
        { id: uid(), title: 'CC 课程学习', date: t(2), time: '19:00', cat: 'study', tag: 'CC 会计', place: '', note: '', remind: 15, done: false, cost: 0, pool: 'hobby', priority: 'p1' },
        { id: uid(), title: '美甲', date: t(4), time: '14:00', cat: 'art', tag: '美甲', place: '', note: '', remind: 30, done: false, cost: 200, pool: 'hobby', priority: 'p4' },
        { id: uid(), title: '做苹果派', date: t(5), time: '10:00', cat: 'life', tag: '烘焙', place: '家', note: '消耗苹果和淡奶油', remind: 0, done: false, cost: 0, pool: 'hobby', priority: 'p2' }
      ],
      bakeLog: [
        { date: todayStr(-3), title: '经典苹果派' }
      ],
      intercepts: [],
      posts: [
        { id: uid(), platform: '小红书', type: '萌物', title: '轻松熊披萨碗开箱', date: t(3), tags: '#轻松熊 #治愈系 #萌物收藏', status: 'planned' }
      ],
      thinkLog: [],
      words: [
        { cn: '空调', en: 'Air Conditioner' },
        { cn: '除湿机', en: 'Dehumidifier' },
        { cn: '潜水面镜', en: 'Diving Mask' },
        { cn: '浮潜', en: 'Snorkeling' },
        { cn: '烤箱', en: 'Oven' },
        { cn: '擀面杖', en: 'Rolling Pin' }
      ]
    };
  }

  function normalize(s) {
    if (!s) return seed();
    const d = {
      settings: { monthlyBudget: 6000, pools: { must: 4000, hobby: 1000, street: 1000 } },
      month: monthStr(), expenses: [], pending: [], reimbursements: [],
      skincareStock: [], recipes: [], inventory: [], equipment: [],
      tasks: [], posts: [], thinkLog: [], words: [], bakeLog: [], intercepts: []
    };
    const out = Object.assign(d, s);
    if (!out.settings) out.settings = {};
    if (!out.settings.monthlyBudget) out.settings.monthlyBudget = 6000;
    if (!out.settings.pools) out.settings.pools = { must: 4000, hobby: 1000, street: 1000 };
    out.theme = Object.assign({}, DEFAULT_THEME, out.theme || {});
    out.theme.custom = Object.assign({}, out.theme.custom || {});
    out.background = Object.assign({}, DEFAULT_BACKGROUND, out.background || {});
    out.tagColors = Object.assign({}, DEFAULT_TAG_COLORS, out.tagColors || {});
    out.tagEmoji = Object.assign({}, DEFAULT_TAG_EMOJI, out.tagEmoji || {});
    out.catColors = Object.assign({}, DEFAULT_CAT_COLORS, out.catColors || {});
    out.priorityColors = Object.assign({}, DEFAULT_PRIORITY, out.priorityColors || {});
    out.sync = Object.assign({}, DEFAULT_SYNC, out.sync || {});
    out.copy = Object.assign({}, DEFAULT_COPY, out.copy || {});
    out.copy.ui = Object.assign({}, DEFAULT_COPY.ui, out.copy.ui || {});
    out.month = out.month || monthStr();
    out.expenses.forEach(e => { if (e.tag === undefined) e.tag = e.emotional ? 'emo' : ''; if (e.reimb === undefined) e.reimb = ''; });
    out.pending.forEach(p => { if (!p.checks) p.checks = { xhs: false, xianyu: '', taobao: '' }; if (!p.shipping) p.shipping = { total: 0, items: 1 }; });
    out.equipment.forEach(x => { if (x.for === undefined) x.for = '通用'; if (!x.pro) x.pro = false; });
    out.tasks.forEach(t => { if (t.place === undefined) t.place = ''; if (t.remind === undefined) t.remind = 30; if (t.priority === undefined) t.priority = ''; });
    out.recipes.forEach(r => { if (r.createdAt === undefined) r.createdAt = ''; });
    return out;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { return null; }
    for (const k of LEGACY_KEYS) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* ignore */ }
    }
    return null;
  }

  let state = normalize(load());

  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function exportJson() { return JSON.stringify(state, null, 2); }
  function importJson(json) { state = normalize(JSON.parse(json)); save(); }
  function resetDemo() { state = seed(); save(); }

  window.Store = {
    KEY, CATS, POOL_META, TAGS, TAG_LABEL,
    APP_VERSION,
    get state() { return state; },
    save, uid, todayStr, monthStr, exportJson, importJson, resetDemo,
    defaultCopy: DEFAULT_COPY,
    defaults: {
      theme: DEFAULT_THEME, background: DEFAULT_BACKGROUND, tagColors: DEFAULT_TAG_COLORS,
      tagEmoji: DEFAULT_TAG_EMOJI, catColors: DEFAULT_CAT_COLORS,
      priorityColors: DEFAULT_PRIORITY, sync: DEFAULT_SYNC
    }
  };
})();
