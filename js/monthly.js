/* ============================================================
 * 月底总结：资金 / 烘焙 / 日程 / 内容 / 思考 自动汇总
 * ============================================================ */
(function () {
  const S = () => Store.state;
  const money = n => '¥' + (Number(n) || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const fmt = n => (Number(n) || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });

  function tsMonth(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function collect() {
    const m = S().month;
    const ex = S().expenses.filter(e => (e.date || '').slice(0, 7) === m);
    const spent = ex.reduce((a, e) => a + Number(e.amount || 0), 0);
    const budget = Number(S().settings.monthlyBudget) || 0;
    const reserved = S().tasks.filter(t => !t.done && t.cost > 0 && (t.date || '').slice(0, 7) === m).reduce((a, t) => a + Number(t.cost || 0), 0);
    const pools = {};
    Object.keys(Store.POOL_META).forEach(p => {
      pools[p] = {
        spent: ex.filter(e => e.pool === p).reduce((a, e) => a + Number(e.amount || 0), 0),
        alloc: S().settings.pools[p] || 0
      };
    });
    const tagged = ex.filter(e => e.tag);
    const pendNew = S().pending.filter(p => tsMonth(p.addedAt) === m);
    const pendBought = pendNew.filter(p => p.status === 'bought');
    const pendRej = pendNew.filter(p => p.status === 'rejected');
    const intercepts = S().intercepts.filter(i => (i.date || '').slice(0, 7) === m).length;
    const rbPending = S().reimbursements.filter(r => r.status === 'pending' || r.status === 'reported').reduce((a, r) => a + Number(r.amount || 0), 0);
    const rbGot = S().reimbursements.filter(r => r.status === 'approved').reduce((a, r) => a + Number(r.amount || 0), 0);
    const bakes = S().bakeLog.filter(b => (b.date || '').slice(0, 7) === m);
    const bakeCount = {};
    bakes.forEach(b => { bakeCount[b.title] = (bakeCount[b.title] || 0) + 1; });
    const recipesNew = S().recipes.filter(r => (r.createdAt || '').slice(0, 7) === m).length;
    const expiring = S().inventory.filter(i => window.Baking && Baking.daysTo(i.expiry) <= 7).length;
    const tasks = S().tasks.filter(t => (t.date || '').slice(0, 7) === m);
    const done = tasks.filter(t => t.done);
    const byCat = {};
    const CAT_NAME = { sports: '游泳', art: '艺术', study: '学习', life: '生活' };
    tasks.forEach(t => { byCat[CAT_NAME[t.cat] || t.cat] = (byCat[CAT_NAME[t.cat] || t.cat] || 0) + 1; });
    const byPri = {};
    const PRI_NAME = { p1: '重要且紧急', p2: '重要不紧急', p3: '紧急不重要', p4: '不重要不紧急' };
    tasks.filter(t => t.priority).forEach(t => { byPri[PRI_NAME[t.priority] || t.priority] = (byPri[PRI_NAME[t.priority] || t.priority] || 0) + 1; });
    const posts = S().posts.filter(p => (p.date || '').slice(0, 7) === m);
    const postByPlat = {};
    posts.forEach(p => { postByPlat[p.platform] = (postByPlat[p.platform] || 0) + 1; });
    const thinks = S().thinkLog.filter(x => (x.date || '').slice(0, 7) === m).length;
    const streak = window.Thinking ? Thinking.streak() : 0;
    return {
      m, spent, budget, reserved, pools, tagged, pendNew, pendBought, pendRej,
      intercepts, rbPending, rbGot, bakes, bakeCount, recipesNew, expiring,
      tasks, done, byCat, byPri, posts, postByPlat, thinks, streak
    };
  }

  function advice(s) {
    const tips = [];
    const taggedAmt = s.tagged.reduce((a, e) => a + Number(e.amount || 0), 0);
    if (s.spent > 0 && taggedAmt / s.spent > 0.2) tips.push('标记支出占比偏高，下单前多走 24 小时冷静期');
    if (s.pools.must.spent + s.pools.must.alloc === 0 ? false : s.pools.must.spent > s.pools.must.alloc) tips.push('必须支出超支，下月先压非必要项');
    const rate = s.tasks.length ? s.done.length / s.tasks.length : 0;
    if (s.tasks.length >= 4 && rate < 0.5) tips.push('完成率偏低，下月安排减量或拆成小步骤');
    if (!s.bakes.length && s.expiring > 0) tips.push(`有 ${s.expiring} 种食材临期，先做一次大消耗烘焙`);
    if (s.rbPending > 0) tips.push(`还有 ${money(s.rbPending)} 报销没追，去「话术生成器」要回来`);
    if (s.streak >= 3) tips.push(`行动打卡连续 ${s.streak} 天，保持身体动能`);
    return tips.length ? tips.join('；') : '状态不错，保持节奏，减少无意识消费。';
  }

  function render() {
    const s = collect();
    const label = s.m.replace('-', '年') + '月';
    const poolLine = Object.keys(Store.POOL_META).map(p => {
      const st = s.pools[p];
      const pct = st.alloc ? Math.round(st.spent / st.alloc * 100) : 0;
      return `${Store.POOL_META[p].name} ${money(st.spent)}（${pct}%）`;
    }).join(' · ');
    const taggedAmt = s.tagged.reduce((a, e) => a + Number(e.amount || 0), 0);
    const bakeLine = Object.entries(s.bakeCount).map(([t, c]) => `${t}×${c}`).join(' · ') || '—';
    const catLine = Object.entries(s.byCat).map(([k, v]) => `${k} ${v}`).join(' · ') || '—';
    const priLine = Object.entries(s.byPri).map(([k, v]) => `${k} ${v}`).join(' · ') || '—';
    const platLine = Object.entries(s.postByPlat).map(([k, v]) => `${k} ${v}`).join(' · ') || '—';
    const rate = s.tasks.length ? Math.round(s.done.length / s.tasks.length * 100) : 0;
    const text = `📊 ${label} · 生活月报

💰 资金
· 预算 ${money(s.budget)} · 已花 ${money(s.spent)} · 剩余 ${money(s.budget - s.spent)}${s.reserved ? `（含预留 ${money(s.reserved)}）` : ''}
· ${poolLine}
· 标记支出 ${s.tagged.length} 笔 ${money(taggedAmt)}（非必要情绪/运费/扭蛋）
· 冷静期：新增 ${s.pendNew.length} 件 · 成交 ${s.pendBought.length} · 放弃 ${s.pendRej.length} · 拦截护肤 ${s.intercepts} 次
· 报销：待追 ${money(s.rbPending)} · 已到账 ${money(s.rbGot)}

🥧 烘焙
· 本月做烘焙 ${s.bakes.length} 次：${bakeLine}
· 新增配方 ${s.recipesNew} 个 · 库存临期 ${s.expiring} 种

🗓️ 日程
· 安排 ${s.tasks.length} 项 · 完成 ${s.done.length}（${rate}%）
· 模块分布：${catLine}
· 轻重缓急：${priLine}

📱 内容
· 排期 ${s.posts.length} 条：${platLine}

🧘 思考
· 本月行动打卡 ${s.thinks} 次 · 当前连续 ${s.streak} 天

💡 一句话建议：${advice(s)}`;
    document.getElementById('mReport').textContent = text;
  }

  function copy() {
    const el = document.getElementById('mReport');
    if (!el.textContent) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(el.textContent).then(() => Finance.toast('月报已复制 ✓'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = el.textContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      Finance.toast('月报已复制 ✓');
    }
  }

  function download() {
    const el = document.getElementById('mReport');
    if (!el.textContent) return;
    const blob = new Blob([el.textContent], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = S().month + '-生活月报.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function bind() {
    document.getElementById('mCopy').addEventListener('click', copy);
    document.getElementById('mDownload').addEventListener('click', download);
  }

  window.Monthly = {
    init() { bind(); },
    render, collect
  };
})();
