/* ============================================================
 * 模块一：资金与消费管控
 * ============================================================ */
(function () {
  const S = () => Store.state;
  const fmt = n => (Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const money = n => '¥' + fmt(n);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function monthExpenses() {
    const m = S().month;
    return S().expenses.filter(e => (e.date || '').slice(0, 7) === m);
  }
  function poolSpent(pool) {
    return monthExpenses().filter(e => e.pool === pool).reduce((a, e) => a + Number(e.amount || 0), 0);
  }
  function reservedCost(pool) {
    return S().tasks.filter(t => !t.done && t.cost > 0 && t.pool === pool).reduce((a, t) => a + Number(t.cost || 0), 0);
  }
  function poolStatus(pool) {
    const alloc = S().settings.pools[pool] || 0;
    const spent = poolSpent(pool);
    const reserved = reservedCost(pool);
    return { alloc, spent, reserved, left: alloc - spent - reserved };
  }
  function totalSpent() { return monthExpenses().reduce((a, e) => a + Number(e.amount || 0), 0); }
  function totalReserved() { return S().tasks.filter(t => !t.done && t.cost > 0).reduce((a, t) => a + Number(t.cost || 0), 0); }

  function emotionalStats() {
    const list = monthExpenses().filter(e => e.tag);
    return { count: list.length, amount: list.reduce((a, e) => a + Number(e.amount || 0), 0) };
  }

  function suggestPool(name) {
    const n = (name || '');
    if (/loverboy|palace|supreme|潮牌|帽子|卫衣|联名|相机|镜头/i.test(n)) return 'street';
    if (/面粉|黄油|奶油|鸡蛋|苹果|蔬菜|水果|肉|牛奶|米|油|盐|房租|水电|地铁|公交/.test(n)) return 'must';
    return 'hobby';
  }

  function suggestCat(pool, name) {
    const n = (name || '');
    if (pool === 'street') {
      if (/loverboy/i.test(n)) return 'Loverboy';
      if (/palace/i.test(n)) return 'Palace';
      if (/supreme/i.test(n)) return 'Supreme';
      return '其他';
    }
    if (pool === 'hobby') {
      if (n.includes('美甲')) return '美甲';
      if (/扭蛋|杂物|挂件|盲盒/.test(n)) return '日本小杂物';
      if (n.includes('代购')) return '轻度代购';
      if (/面粉|黄油|奶油|模具|打蛋器|烤箱|烘焙/.test(n)) return '烘焙原料';
      if (/咖啡|奶茶|逛街|餐厅/.test(n)) return '逛街咖啡';
      if (/书|教材|课程/.test(n)) return '书籍';
      return '其他';
    }
    if (/水电|房租/.test(n)) return '水电房租';
    if (/学习|课程|CC|学费/.test(n)) return '固定学习';
    if (/车|地铁|公交|打车/.test(n)) return '固定交通';
    return '饮食';
  }

  function autoTag(name) {
    if (/扭蛋|盲盒/.test(name)) return 'gacha';
    if (/运费|邮费|海运|顺丰/.test(name)) return 'ship';
    if (/美甲|皮肤|衣服|裙子|鞋|包|口红|香水|首饰/.test(name)) return 'emo';
    return '';
  }

  const SKINCARE_WORDS = ['护肤', '化妆品', '眼霜', '精华', '面霜', '水乳', '面膜', '口红', '粉底', '隔离', '防晒', '洗面奶', '卸妆', 'CPB', '精纯', '雅诗兰黛', '兰蔻', '娇兰', '海蓝之谜', 'SK-II'];

  /* ---------------- 预算 ---------------- */
  function renderBudget() {
    const s = S();
    document.getElementById('fBudget').value = s.settings.monthlyBudget;
    document.getElementById('fPools').innerHTML = Object.keys(Store.POOL_META).map(p => `
      <div class="form-row">
        <label>${Store.POOL_META[p].name}（月额度 ¥）</label>
        <input type="number" data-pool="${p}" class="pool-alloc" value="${s.settings.pools[p]}" min="0" step="100">
      </div>`).join('');
  }

  function saveBudget() {
    const s = S();
    s.settings.monthlyBudget = Math.max(0, Number(document.getElementById('fBudget').value) || 0);
    document.querySelectorAll('.pool-alloc').forEach(inp => {
      s.settings.pools[inp.dataset.pool] = Math.max(0, Number(inp.value) || 0);
    });
    Store.save();
    renderAll();
    toast('预算已保存 ✓');
  }

  function poolBarHtml(pool) {
    const st = poolStatus(pool);
    const used = st.spent + st.reserved;
    const pct = st.alloc ? Math.min(100, used / st.alloc * 100) : 0;
    const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
    return `
      <div class="bar-wrap">
        <div class="bar-label">
          <span>${Store.POOL_META[pool].name} · ${money(st.alloc)}</span>
          <b>${money(st.spent)} 已花${st.reserved ? ` · ${money(st.reserved)} 预留` : ''} · 剩 ${money(st.left)}</b>
        </div>
        <div class="bar ${cls}"><i style="width:${pct}%"></i></div>
      </div>`;
  }

  /* ---------------- 支出 ---------------- */
  function renderExpenseFormCats() {
    const pool = document.getElementById('fExpPool').value;
    document.getElementById('fExpCat').innerHTML = (Store.CATS[pool] || []).map(c => `<option>${c}</option>`).join('');
    const date = document.getElementById('fExpDate');
    if (!date.value) date.value = Store.todayStr();
  }

  function addExpense({ amount, pool, cat, note, tag, reimb, date, source }) {
    S().expenses.unshift({
      id: Store.uid(), date: date || Store.todayStr(), amount: Number(amount),
      pool, cat: cat || suggestCat(pool, note), note: note || '',
      tag: tag || '', reimb: reimb || '', source: source || 'manual'
    });
    if (reimb === 'direct' || reimb === 'probable') {
      S().reimbursements.unshift({
        id: Store.uid(), name: note || cat, amount: Number(amount), type: reimb,
        status: 'pending', note: '', date: date || Store.todayStr()
      });
    }
    Store.save();
  }

  function renderExpenseList() {
    const q = (document.getElementById('fSearch').value || '').trim().toLowerCase();
    const fp = document.getElementById('fFilterPool').value;
    let list = monthExpenses().sort((a, b) => b.date.localeCompare(a.date));
    if (fp) list = list.filter(e => e.pool === fp);
    if (q) list = list.filter(e => (e.note + e.cat + e.pool + (e.tag || '')).toLowerCase().includes(q));
    const el = document.getElementById('fExpenseList');
    if (!list.length) { el.innerHTML = '<div class="empty">本月还没有支出记录。</div>'; return; }
    const sum = list.reduce((a, e) => a + Number(e.amount), 0);
    el.innerHTML = list.map(e => `
      <div class="expense-row">
        <span class="item-sub">${e.date.slice(5)}</span>
        <span class="chip ghost-chip">${Store.POOL_META[e.pool] ? Store.POOL_META[e.pool].name : e.pool}</span>
        <span>${e.cat}</span>
        <span class="item-sub">${esc(e.note)}</span>
        ${e.tag ? `<span class="flag">${Store.TAG_LABEL[e.tag] || ''}</span>` : ''}
        ${e.reimb === 'direct' ? '<span class="chip">可报销</span>' : e.reimb === 'probable' ? '<span class="chip ghost-chip">概率报销</span>' : ''}
        <span class="expense-amt">${money(e.amount)}</span>
        <button class="btn tiny danger" data-del-exp="${e.id}">删</button>
      </div>`).join('') +
      `<div class="expense-row"><b>本月合计</b><span class="expense-amt">${money(sum)}</span></div>`;
  }

  /* ---------------- 待购冷静期 + 拦截 ---------------- */
  function addPending(name, price, source, url, after) {
    const n = (name || '');
    const unopened = S().skincareStock.filter(x => x.state === '未拆封').map(x => x.name);
    const isSkincare = SKINCARE_WORDS.some(w => n.toLowerCase().includes(w.toLowerCase()));
    const doAdd = () => {
      const now = Date.now();
      S().pending.unshift({
        id: Store.uid(), name: n, price: Number(price) || 0, source, url: url || '',
        addedAt: now, coolUntil: now + 24 * 3600 * 1000, status: 'cooling',
        checks: { xhs: false, xianyu: '', taobao: '' },
        shipping: { total: 0, items: 1 }
      });
      Store.save();
      if (after) after();
    };
    if (isSkincare && unopened.length) {
      S().intercepts.push({ date: Store.todayStr(), name: n });
      showModal(
        S().copy.interceptTitle || '⚠️ 拦截提醒：先清库存',
        (S().copy.interceptBody || '').replace(/\{list\}/g, unopened.join('、')),
        doAdd
      );
      return false;
    }
    doAdd();
    return true;
  }

  function pendingCard(p) {
    const now = Date.now();
    const cooling = p.status === 'cooling' && now < p.coolUntil;
    const statusChip = cooling
      ? '<span class="chip">⏳ 冷静中</span>'
      : p.status === 'bought' ? '<span class="chip bold">已买</span>'
      : p.status === 'rejected' ? '<span class="chip ghost-chip">已放弃</span>'
      : '<span class="chip">可决定</span>';
    const cd = cooling ? `<span class="countdown" data-cd="${p.coolUntil}">…</span>` : '';
    const compare = `
      <div class="item-sub" style="margin-top:8px">
        比价三步法：
        <label class="check" style="margin:4px 0"><input type="checkbox" data-xhs="${p.id}" ${p.checks.xhs ? 'checked' : ''}> 小红书实物图/买家秀已看</label>
        <div class="inline-form" style="margin:0">
          <input placeholder="闲鱼二手价 ¥" data-xianyu="${p.id}" value="${esc(p.checks.xianyu)}">
          <input placeholder="淘宝现货到手价 ¥" data-taobao="${p.id}" value="${esc(p.checks.taobao)}">
        </div>
        <div class="inline-form" style="margin:0">
          <input placeholder="国际运费合计 ¥" data-shiptotal="${p.id}" value="${esc(p.shipping.total) || ''}">
          <input type="number" placeholder="件数" data-shipitems="${p.id}" value="${p.shipping.items || 1}" min="1" style="max-width:80px">
        </div>
      </div>`;
    const ship = shippingVerdict(p);
    const buyBtn = cooling
      ? '<button class="btn tiny" disabled>⏳ 等冷静期结束</button>'
      : p.status === 'cooling' ? '<button class="btn tiny" data-buy="' + p.id + '">确认购买</button>' : '';
    const rejectBtn = p.status === 'cooling' || p.status === 'bought'
      ? '' : '<button class="btn tiny ghost" data-reject="' + p.id + '">放弃</button>';
    return `
      <div class="item">
        <div class="item-head">
          <div>
            <span class="item-title">${esc(p.name)}</span> ${statusChip} ${cd}
            <div class="item-sub">${esc(p.source)}${p.url ? ' · <a href="' + esc(p.url) + '" target="_blank" rel="noopener">链接</a>' : ''} · 预估 ${money(p.price)}</div>
          </div>
          <div class="item-actions">${buyBtn}${rejectBtn}</div>
        </div>
        ${ship.html}
        ${compare}
        ${p.status === 'rejected' ? '<div class="item-sub" style="margin-top:6px">放弃原因：' + esc(p.reason || '未填写') + '</div>' : ''}
      </div>`;
  }

  function renderPending() {
    const el = document.getElementById('fPendingList');
    if (!S().pending.length) { el.innerHTML = '<div class="empty">冷静期清单是空的。</div>'; return; }
    el.innerHTML = S().pending.map(pendingCard).join('');
  }

  function refreshCountdowns() {
    document.querySelectorAll('[data-cd]').forEach(el => {
      const left = Number(el.dataset.cd) - Date.now();
      if (left <= 0) { renderPending(); return; }
      const h = Math.floor(left / 3600000), m = Math.floor(left % 3600000 / 60000);
      el.textContent = `还剩 ${h}小时${m}分`;
    });
  }

  function shippingVerdict(p) {
    const c = p.checks, s = p.shipping;
    if (c.taobao && p.price > 0 && s.total > 0 && s.items > 0) {
      const per = s.total / s.items;
      const jp = p.price + per;
      if (jp >= Number(c.taobao)) {
        return { html: `<div class="item-sub">📦 日代到手约 ${money(jp)} ≥ 淘宝 ${money(c.taobao)} → <b>不建议日代</b></div>` };
      }
      return { html: `<div class="item-sub">📦 日代到手约 ${money(jp)} < 淘宝 ${money(c.taobao)} → <b>可考虑日代</b></div>` };
    }
    return { html: '<div class="item-sub">📦 填完淘宝价与运费后自动对比日代是否划算。</div>' };
  }

  function buyPending(id) {
    const p = S().pending.find(x => x.id === id);
    if (!p) return;
    const pool = suggestPool(p.name);
    p.status = 'bought';
    p.boughtAt = Date.now();
    S().expenses.unshift({
      id: Store.uid(), date: Store.todayStr(), amount: Number(p.price) || 0,
      pool, cat: suggestCat(pool, p.name), note: p.name,
      tag: autoTag(p.name), reimb: '', source: 'purchase', pendingId: id
    });
    Store.save();
    renderAll();
    toast(`已购买，从「${Store.POOL_META[pool].name}」扣除 ${money(p.price)}`);
  }

  function rejectPending(id, reason) {
    const p = S().pending.find(x => x.id === id);
    if (!p) return;
    p.status = 'rejected';
    p.reason = reason || '';
    Store.save();
    renderAll();
    toast('已放弃，省下 ' + money(p.price));
  }

  /* ---------------- 账单导入 ---------------- */
  function parseCsv(text) {
    const rows = [];
    let row = [], cur = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
        row = []; cur = '';
      } else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  function importBill(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(reader.result);
      if (rows.length < 2) { toast('没读到有效内容', true); return; }
      let headerIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 12); i++) {
        const joined = rows[i].join(',');
        if (/时间/.test(joined) && /金额/.test(joined)) { headerIdx = i; break; }
      }
      if (headerIdx < 0) { toast('找不到表头（需含「时间」和「金额」）', true); return; }
      const head = rows[headerIdx];
      const idx = {
        date: head.findIndex(h => /时间/.test(h)),
        amount: head.findIndex(h => /金额/.test(h)),
        type: head.findIndex(h => /收\s?\/?\s?支|收支/.test(h)),
        cat: head.findIndex(h => /类型|对方|商品|商户/.test(h)),
        note: head.findIndex(h => /备注/.test(h))
      };
      const month = S().month;
      let added = 0, skipped = 0, total = 0;
      for (const r of rows.slice(headerIdx + 1)) {
        if (!r[idx.date] || !r[idx.amount]) continue;
        const dateStr = String(r[idx.date]).trim().replace(/\//g, '-').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
        const typeStr = idx.type >= 0 ? String(r[idx.type] || '') : '';
        if (/收入|转入|退款|不计收支/.test(typeStr)) continue;
        if (dateStr.slice(0, 7) !== month) { skipped++; continue; }
        let amt = parseFloat(String(r[idx.amount]).replace(/[^\d.-]/g, ''));
        if (isNaN(amt) || amt === 0) continue;
        if (amt < 0) amt = -amt;
        const note = idx.note >= 0 ? String(r[idx.note] || '') : '';
        const catRaw = idx.cat >= 0 ? String(r[idx.cat] || '') : '';
        const name = (catRaw + ' ' + note).trim();
        const pool = suggestPool(name);
        S().expenses.unshift({
          id: Store.uid(), date: dateStr, amount: amt, pool,
          cat: suggestCat(pool, name), note: name.slice(0, 30),
          tag: autoTag(note + catRaw), reimb: '', source: 'bill'
        });
        added++; total += amt;
      }
      Store.save();
      const el = document.getElementById('billPreview');
      el.classList.add('show');
      el.innerHTML = `已导入本月 ${added} 笔，合计 ${money(total)}${skipped ? `；跳过 ${skipped} 笔非本月/收入记录` : ''}`;
      renderAll();
      toast(`账单导入完成：${added} 笔`);
    };
    reader.readAsText(file);
  }

  /* ---------------- 报销追踪 ---------------- */
  const REIMB_STATUS = { pending: '待报销', reported: '已上报', approved: '已到账', rejected: '被拒' };
  const REIMB_TYPE = { direct: '直接报销', probable: '概率报销', self: '自费不可报' };

  function renderReimbursements() {
    const el = document.getElementById('reimburseList');
    const list = S().reimbursements;
    if (!list.length) { el.innerHTML = '<div class="empty">还没有报销记录。把可报销的支出标记后会自动出现。</div>'; return; }
    el.innerHTML = `<table class="table">
      <tr><th>项目</th><th>类型</th><th>金额</th><th>状态</th><th>操作</th></tr>
      ${list.map(r => `<tr>
        <td>${esc(r.name)}</td>
        <td><span class="chip ghost-chip">${REIMB_TYPE[r.type]}</span></td>
        <td><b>${money(r.amount)}</b></td>
        <td><span class="chip ${r.status === 'approved' ? 'bold' : ''}">${REIMB_STATUS[r.status]}</span></td>
        <td>
          ${r.status === 'pending' ? `<button class="btn tiny" data-reimb-report="${r.id}">上报</button>` : ''}
          ${r.status === 'reported' ? `<button class="btn tiny" data-reimb-ok="${r.id}">到账</button>` : ''}
          ${r.status === 'pending' || r.status === 'reported' ? `<button class="btn tiny ghost" data-reimb-no="${r.id}">拒绝</button>` : ''}
        </td>
      </tr>`).join('')}
    </table>`;
    const pend = list.filter(r => r.status === 'pending' || r.status === 'reported');
    const rec = list.filter(r => r.status === 'approved').reduce((a, r) => a + Number(r.amount), 0);
    document.getElementById('reimbPick').innerHTML = pend.length
      ? pend.map(r => `<option value="${r.id}">${esc(r.name)} · ${money(r.amount)}</option>`).join('')
      : '<option value="">暂无可生成话术的待报销项</option>';
  }

  function setReimbStatus(id, status) {
    const r = S().reimbursements.find(x => x.id === id);
    if (!r) return;
    r.status = status;
    Store.save();
    renderReimbursements();
    renderAll();
  }

  function genSpeech() {
    const id = document.getElementById('reimbPick').value;
    const out = document.getElementById('reimbOut');
    const r = S().reimbursements.find(x => x.id === id);
    if (!r) { out.textContent = '先选一笔待报销的支出。'; return; }
    const tpl = {};
    (S().copy.speech || '').split('\n').forEach(raw => {
      const l = raw.trim();
      if (!l) return;
      const i = l.indexOf('：');
      if (i < 0) return;
      tpl[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    });
    const text = (tpl[r.type] || '')
      .replace(/\{name\}/g, r.name)
      .replace(/\{amount\}/g, money(r.amount))
      .replace(/\{note\}/g, r.note || r.name);
    out.textContent = text;
  }

  /* ---------------- 护肤品拦截清单 ---------------- */
  function renderSkincare() {
    const el = document.getElementById('skincareList');
    const list = S().skincareStock;
    if (!list.length) { el.innerHTML = '<div class="empty">还没有存货记录。</div>'; return; }
    el.innerHTML = list.map(x => `
      <div class="inv-row">
        <span class="inv-name">${esc(x.name)}</span>
        <span class="chip ${x.state === '未拆封' ? 'bold' : 'ghost-chip'}">${x.state}</span>
        <span class="inv-meta"><button class="btn tiny ghost" data-skin-open="${x.id}">${x.state === '未拆封' ? '已拆封' : '已用完'}</button></span>
        <button class="btn tiny danger" data-skin-del="${x.id}">删</button>
      </div>`).join('');
  }

  /* ---------------- 运费核算 ---------------- */
  function calcShipping() {
    const total = Number(document.getElementById('fShipTotal').value) || 0;
    const items = Number(document.getElementById('fShipItems').value) || 1;
    const price = Number(document.getElementById('fShipPrice').value) || 0;
    const tb = Number(document.getElementById('fShipTb').value) || 0;
    const el = document.getElementById('fShipResult');
    el.classList.add('show');
    if (!tb) { el.innerHTML = '请填「淘宝现货到手价」才能对比。'; return; }
    if (!total || !items || !price) { el.innerHTML = '请填全运费、件数、单品价格。'; return; }
    const per = total / items;
    const jp = price + per;
    const diff = jp - tb;
    el.innerHTML = `单件均摊运费 ${money(per)}（${money(total)} ÷ ${items} 件）
日代到手 ${money(jp)} vs 国内现货 ${money(tb)}
${diff >= 0 ? `→ 不建议日代（贵 ${money(diff)}），直接买现货` : `→ 可考虑日代（省 ${money(-diff)}）`}`;
  }

  /* ---------------- 通用 ---------------- */
  function renderFinance() {
    renderBudget();
    renderExpenseFormCats();
    renderExpenseList();
    renderPending();
    renderReimbursements();
    renderSkincare();
  }

  function renderAll() {
    const active = document.querySelector('.view.active');
    if (active && active.id === 'view-finance') renderFinance();
    if (active && active.id === 'view-dashboard' && window.App) App.renderDashboard();
  }

  let toastTimer = null;
  function toast(msg, warn) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show' + (warn ? ' warn' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.className = 'toast', 2600);
  }

  function showModal(title, body, onOk) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').textContent = body;
    const mask = document.getElementById('modalMask');
    mask.classList.add('show');
    const ok = document.getElementById('modalOk');
    const cancel = document.getElementById('modalCancel');
    ok.onclick = () => { mask.classList.remove('show'); if (onOk) onOk(); };
    cancel.onclick = () => { mask.classList.remove('show'); toast('已拦截，先清库存再说'); };
  }

  function bind() {
    document.getElementById('fExpenseForm').addEventListener('submit', e => {
      e.preventDefault();
      addExpense({
        amount: document.getElementById('fExpAmount').value,
        pool: document.getElementById('fExpPool').value,
        cat: document.getElementById('fExpCat').value,
        note: document.getElementById('fExpNote').value,
        tag: document.getElementById('fExpTag').value,
        reimb: document.getElementById('fExpReimb').value
      });
      e.target.reset();
      document.getElementById('fExpDate').value = Store.todayStr();
      renderAll();
      toast('支出已记账 ✓');
    });
    document.getElementById('fExpPool').addEventListener('change', renderExpenseFormCats);
    document.getElementById('fSaveBudget').addEventListener('click', saveBudget);
    document.getElementById('fSearch').addEventListener('input', renderExpenseList);
    document.getElementById('fFilterPool').addEventListener('change', renderExpenseList);
    document.getElementById('fShipCalc').addEventListener('click', calcShipping);
    document.getElementById('billFile').addEventListener('change', e => {
      if (e.target.files[0]) importBill(e.target.files[0]);
      e.target.value = '';
    });

    document.getElementById('fPendingForm').addEventListener('submit', e => {
      e.preventDefault();
      addPending(
        document.getElementById('fPendName').value,
        document.getElementById('fPendPrice').value,
        document.getElementById('fPendSource').value,
        document.getElementById('fPendUrl').value,
        () => { e.target.reset(); renderAll(); toast('已加入 24 小时冷静期 ⏳'); }
      );
    });

    document.getElementById('fPendingList').addEventListener('click', e => {
      const buy = e.target.closest('[data-buy]');
      const rej = e.target.closest('[data-reject]');
      const del = e.target.closest('[data-del-exp]');
      if (buy) {
        const reason = prompt('购买理由（写下来更容易冷静）：');
        if (reason === null) return;
        buyPending(buy.dataset.buy);
      } else if (rej) {
        rejectPending(rej.dataset.reject, prompt('放弃原因：') || '');
      } else if (del) {
        S().expenses = S().expenses.filter(x => x.id !== del.dataset.delExp);
        Store.save();
        renderAll();
      }
    });
    document.getElementById('fPendingList').addEventListener('change', e => {
      const xhs = e.target.closest('[data-xhs]');
      const xy = e.target.closest('[data-xianyu]');
      const tb = e.target.closest('[data-taobao]');
      const st = e.target.closest('[data-shiptotal]');
      const si = e.target.closest('[data-shipitems]');
      let p = null;
      if (xhs) { p = S().pending.find(x => x.id === xhs.dataset.xhs); if (p) p.checks.xhs = xhs.checked; }
      if (xy) { p = S().pending.find(x => x.id === xy.dataset.xianyu); if (p) p.checks.xianyu = xy.value; }
      if (tb) { p = S().pending.find(x => x.id === tb.dataset.taobao); if (p) p.checks.taobao = tb.value; }
      if (st) { p = S().pending.find(x => x.id === st.dataset.shiptotal); if (p) p.shipping.total = Number(st.value) || 0; }
      if (si) { p = S().pending.find(x => x.id === si.dataset.shipitems); if (p) p.shipping.items = Math.max(1, Number(si.value) || 1); }
      if (p) { Store.save(); renderPending(); }
    });

    document.getElementById('reimburseList').addEventListener('click', e => {
      const rp = e.target.closest('[data-reimb-report]');
      const ok = e.target.closest('[data-reimb-ok]');
      const no = e.target.closest('[data-reimb-no]');
      if (rp) setReimbStatus(rp.dataset.reimbReport, 'reported');
      if (ok) setReimbStatus(ok.dataset.reimbOk, 'approved');
      if (no) setReimbStatus(no.dataset.reimbNo, 'rejected');
    });
    document.getElementById('reimbGen').addEventListener('click', genSpeech);

    document.getElementById('skincareForm').addEventListener('submit', e => {
      e.preventDefault();
      S().skincareStock.push({
        id: Store.uid(),
        name: document.getElementById('skincareName').value.trim(),
        state: document.getElementById('skincareState').value
      });
      Store.save();
      e.target.reset();
      renderSkincare();
      toast('已加入拦截清单');
    });
    document.getElementById('skincareList').addEventListener('click', e => {
      const open = e.target.closest('[data-skin-open]');
      const del = e.target.closest('[data-skin-del]');
      if (open) {
        const x = S().skincareStock.find(i => i.id === open.dataset.skinOpen);
        if (x) x.state = x.state === '未拆封' ? '已拆封' : '已用完';
        Store.save();
        renderSkincare();
      }
      if (del) {
        S().skincareStock = S().skincareStock.filter(i => i.id !== del.dataset.skinDel);
        Store.save();
        renderSkincare();
      }
    });

    setInterval(refreshCountdowns, 30000);
    refreshCountdowns();
  }

  window.Finance = {
    init() { bind(); renderFinance(); },
    renderFinance, renderAll, renderPending, renderReimbursements, renderSkincare,
    monthExpenses, poolSpent, reservedCost, poolStatus, totalSpent, totalReserved,
    emotionalStats, suggestPool, suggestCat, autoTag, addExpense, addPending,
    poolBarHtml, money, fmt, esc, toast, parseCsv
  };
})();
