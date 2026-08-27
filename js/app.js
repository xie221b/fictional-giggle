/* ============================================================
 * 应用壳：导航 / 总览 / 备份恢复
 * ============================================================ */
(function () {
  const S = () => Store.state;

  function switchView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    document.getElementById('view-' + name).classList.add('active');
    if (name === 'dashboard') renderDashboard();
    if (name === 'finance') Finance.renderFinance();
    if (name === 'planner') Planner.renderCalendar();
    if (name === 'copy') CopyEdit.render();
    if (name === 'appearance') Theme.renderAll();
    if (name === 'monthly') Monthly.render();
    applyEditState();
  }

  /* ---- 总览界面文字：可点改（改字模式） ---- */
  let editMode = false;

  function applyTexts(vals) {
    const ui = S().copy.ui;
    const h1 = document.querySelector('[data-text="heroTitle"]');
    if (h1) h1.textContent = ui.heroTitle || '';
    const sub = document.querySelector('[data-text="heroSub"]');
    if (sub) {
      if (editMode) {
        sub.textContent = ui.heroSub || '';
      } else if (vals) {
        sub.innerHTML = (ui.heroSub || '')
          .replace(/\{budget\}/g, `<span id="dashBudget">${Finance.fmt(vals.budget)}</span>`)
          .replace(/\{spent\}/g, `<span id="dashSpent">${Finance.fmt(vals.spent)}${vals.reserved ? '（另预留 ' + Finance.fmt(vals.reserved) + '）' : ''}</span>`)
          .replace(/\{left\}/g, `<span id="dashLeft">${Finance.fmt(vals.left)}</span>`);
      }
    }
    document.querySelectorAll('[data-text]').forEach(el => {
      const key = el.dataset.text;
      if (key === 'heroTitle' || key === 'heroSub') return;
      if (ui[key] !== undefined) el.textContent = ui[key];
    });
  }

  function applyEditState() {
    document.querySelectorAll('[data-text]').forEach(el => {
      el.contentEditable = editMode ? 'plaintext-only' : 'false';
      el.classList.toggle('editable', editMode);
    });
  }

  function toggleEditMode() {
    editMode = !editMode;
    document.body.classList.toggle('edit-text', editMode);
    document.getElementById('btnEditText').classList.toggle('active', editMode);
    applyTexts();
    applyEditState();
    Finance.toast(editMode ? '改字模式：点任意文字直接改，点空白处自动保存' : '改字模式已关闭');
  }

  function renderDashboard() {
    const budget = Number(S().settings.monthlyBudget) || 0;
    const spent = Finance.totalSpent();
    const reserved = Finance.totalReserved();
    const left = budget - spent - reserved;
    applyTexts({ budget, spent, reserved, left });

    document.getElementById('dashPools').innerHTML = ['must', 'hobby', 'street'].map(Finance.poolBarHtml).join('');

    const pend = S().pending.filter(p => p.status === 'cooling' || p.status === 'rejected').slice(0, 4);
    document.getElementById('dashPending').innerHTML = pend.length
      ? pend.map(p => `
          <div class="expense-row">
            <span class="item-title">${Finance.esc(p.name)}</span>
            <span class="chip ${p.status === 'rejected' ? 'ghost-chip' : ''}">${p.status === 'rejected' ? '已放弃' : '⏳ 冷静中'}</span>
            <span class="expense-amt">${Finance.money(p.price)}</span>
          </div>`).join('')
      : `<div class="empty" data-text="emptyPending">${Finance.esc(S().copy.ui.emptyPending)}</div>`;

    const watch = [];
    Object.keys(Store.POOL_META).forEach(p => {
      const st = Finance.poolStatus(p);
      if (st.left < 0) watch.push(`「${Store.POOL_META[p].name}」超支 ${Finance.money(-st.left)}`);
      else if (st.alloc > 0 && (st.spent + st.reserved) / st.alloc >= 0.8) watch.push(`「${Store.POOL_META[p].name}」已用 ${Math.round((st.spent + st.reserved) / st.alloc * 100)}%`);
    });
    const emo = Finance.emotionalStats();
    if (emo.count) watch.push(`标记支出 ${emo.count} 笔，共 ${Finance.money(emo.amount)}`);
    const due = S().pending.filter(p => p.status === 'cooling' && Date.now() >= p.coolUntil);
    if (due.length) watch.push(`${due.length} 件待购已过冷静期`);
    const expiring = S().inventory.filter(i => Baking.daysTo(i.expiry) <= 3);
    if (expiring.length) watch.push(`${expiring.length} 种食材 3 天内临期`);
    document.getElementById('dashWatch').innerHTML = watch.length
      ? watch.map(w => `<div class="expense-row"><span>⚠️ ${w}</span></div>`).join('')
      : `<div class="empty" data-text="emptyWatch">${Finance.esc(S().copy.ui.emptyWatch)}</div>`;

    const week = S().tasks.filter(t => {
      const d = new Date(t.date + 'T00:00:00');
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const diff = Math.round((d - now) / 86400000);
      return diff >= 0 && diff <= 6;
    }).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    document.getElementById('dashWeek').innerHTML = week.length
      ? week.map(t => `
          <div class="expense-row" style="${t.done ? 'opacity:.45' : ''}">
            <span class="task-time">${t.date.slice(5)} ${t.time || ''}</span>
            <span>${t.done ? '✓ ' : ''}${(t.tag && S().tagEmoji[t.tag]) || ''} ${Finance.esc(t.title)}</span>
            ${t.priority ? `<span class="pri-chip" style="background:${S().priorityColors[t.priority]}">${Theme.priorityLabel[t.priority]}</span>` : ''}
            ${t.cost ? `<span class="task-cost">${Finance.money(t.cost)}</span>` : ''}
          </div>`).join('')
      : `<div class="empty" data-text="emptyWeek">${Finance.esc(S().copy.ui.emptyWeek)}</div>`;

    const inv = [...S().inventory].sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999')).filter(i => Baking.daysTo(i.expiry) <= 7).slice(0, 5);
    document.getElementById('dashExpiry').innerHTML = inv.length
      ? inv.map(i => `<div class="expense-row"><span>${Finance.esc(i.name)}（${i.qty}${i.unit}）</span><span>${Baking.expiryChip(i.expiry)}</span></div>`).join('')
      : `<div class="empty" data-text="emptyExpiry">${Finance.esc(S().copy.ui.emptyExpiry)}</div>`;

    const rb = S().reimbursements;
    const rbPending = rb.filter(r => r.status === 'pending' || r.status === 'reported');
    const rbTotal = rbPending.reduce((a, r) => a + Number(r.amount), 0);
    const rbGot = rb.filter(r => r.status === 'approved').reduce((a, r) => a + Number(r.amount), 0);
    document.getElementById('dashReimburse').innerHTML = rbPending.length
      ? `<div class="kv"><span>待报销 ${rbPending.length} 笔</span><b>${Finance.money(rbTotal)}</b></div>
         <div class="kv"><span>已到账累计</span><b>${Finance.money(rbGot)}</b></div>
         <div class="item-sub">去「资金与消费」一键生成报销话术。</div>`
      : `<div class="empty" data-text="emptyReimburse">${Finance.esc(S().copy.ui.emptyReimburse)}</div>`;

    const st = window.Thinking ? Thinking.streak() : 0;
    document.getElementById('dashStreak').innerHTML = st > 0
      ? `<div class="kv"><span>连续行动</span><b>${st} 天</b></div><div class="item-sub">想完就动，身体会带起状态。</div>`
      : `<div class="empty" data-text="emptyStreak">${Finance.esc(S().copy.ui.emptyStreak)}</div>`;

    const alerts = [];
    if (left < 0) alerts.push('本月已超支，先停掉非必要支出');
    else if (left < budget * 0.15) alerts.push(`本月剩余不多：${Finance.money(left)}`);
    if (due.length) alerts.push(`${due.length} 件待购已过冷静期`);
    if (expiring.length) alerts.push(`${expiring.length} 种食材 3 天内临期`);
    document.getElementById('dashAlerts').innerHTML = alerts.map(a => `<span class="alert-pill">${a}</span>`).join('');
  }

  function backup() {
    const blob = new Blob([Store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '生活架构备份_' + Store.todayStr() + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    Finance.toast('备份已下载 ✅');
  }

  function restore(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importJson(reader.result);
        Finance.toast('数据已恢复 ✓');
        switchView('dashboard');
      } catch (e) {
        Finance.toast('恢复失败：文件格式不对', true);
      }
    };
    reader.readAsText(file);
  }

  function bind() {
    document.getElementById('nav').addEventListener('click', e => {
      const b = e.target.closest('.nav-btn');
      if (b) switchView(b.dataset.view);
    });
    document.getElementById('btnBackup').addEventListener('click', backup);
    document.getElementById('btnRestore').addEventListener('click', () => document.getElementById('restoreFile').click());
    document.getElementById('restoreFile').addEventListener('change', e => {
      if (e.target.files[0]) restore(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('btnEditText').addEventListener('click', toggleEditMode);

    document.addEventListener('focusout', e => {
      if (!editMode) return;
      const el = e.target.closest && e.target.closest('[data-text]');
      if (!el || !el.dataset.text) return;
      S().copy.ui[el.dataset.text] = el.textContent.trim();
      Store.save();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.closest && e.target.closest('[data-text]')) {
        e.preventDefault();
        e.target.blur();
      }
    });
  }

  function boot() {
    Theme.init();
    Sync.init();
    bind();
    Finance.init();
    Baking.init();
    Planner.init();
    Media.init();
    Thinking.init();
    CopyEdit.init();
    Monthly.init();
    document.getElementById('footerVersion').textContent = 'v' + Store.APP_VERSION;
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    switchView('dashboard');
  }

  window.App = { boot, renderDashboard, switchView, applyTexts, applyEditState, toggleEditMode };
  document.addEventListener('DOMContentLoaded', boot);
})();
