/* ============================================================
 * 模块三：日常规划与 iOS 日历联动
 * ============================================================ */
(function () {
  const S = () => Store.state;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const CAT_EMOJI = { sports: '🏊', art: '🎨', study: '📖', life: '🥧' };
  const CAT_NAME = { sports: '体育运动', art: '艺术兴趣', study: '学习与专业', life: '生活休闲' };
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  const WEEK_CN = { '日': 0, '天': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
  let tagFilter = '';
  let calOffset = 0;

  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  function fmtDate(s) {
    const d = new Date(s + 'T00:00:00');
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const diff = Math.round((d - t) / 86400000);
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === 2) return '后天';
    if (diff === -1) return '昨天';
    return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK[d.getDay()]}`;
  }

  /* ---------------- 自然语言解析 ---------------- */
  function parseDate(text) {
    let d = new Date(); d.setHours(0, 0, 0, 0);
    if (text.includes('后天')) d = addDays(d, 2);
    else if (text.includes('明天')) d = addDays(d, 1);
    else if (text.includes('今天')) { /* keep */ }
    else {
      const nw = text.match(/下(?:个)?周([一二三四五六日天])/);
      const aw = text.match(/(?:周|星期)([一二三四五六日天])/);
      if (nw) {
        let days = (WEEK_CN[nw[1]] - d.getDay() + 7) % 7 + 7;
        d = addDays(d, days);
      } else if (aw) {
        let days = (WEEK_CN[aw[1]] - d.getDay() + 7) % 7;
        if (days === 0) days = 7;
        d = addDays(d, days);
      }
    }
    const md = text.match(/(\d{1,2})月(\d{1,2})日/);
    if (md) {
      let cand = new Date(d.getFullYear(), Number(md[1]) - 1, Number(md[2]));
      if (cand < new Date(d.getFullYear(), 0, 1)) cand = new Date(d.getFullYear() + 1, Number(md[1]) - 1, Number(md[2]));
      d = cand; d.setHours(0, 0, 0, 0);
    }
    return ymd(d);
  }

  function parseTime(text) {
    const m = text.match(/(上午|早上|中午|下午|晚上|凌晨)?(\d{1,2})点(?:(\d{1,2})分|半|一刻|(\d{1,2}))?/);
    if (!m) return '';
    const part = m[1] || '';
    let h = Number(m[2]);
    let min = m[3] === '半' ? 30 : m[3] === '一刻' ? 15 : (Number(m[3] || m[4]) || 0);
    if (part === '下午' || part === '晚上') { if (h < 12) h += 12; }
    else if (part === '中午') { if (h < 11) h += 12; }
    else if (part === '凌晨') { if (h === 12) h = 0; }
    else if (!part && h < 7) h += 12;
    if (h >= 24) { h = 23; min = 59; }
    return pad(h) + ':' + pad(min);
  }

  function detectCat(text) {
    if (text.includes('游泳')) return { cat: 'sports', tag: '游泳' };
    if (text.includes('国画') || text.includes('画画')) return { cat: 'art', tag: '国画' };
    if (text.includes('美甲')) return { cat: 'art', tag: '美甲' };
    if (text.includes('CC') || text.includes('会计') || text.includes('课程') || text.includes('学习') || text.includes('上课')) return { cat: 'study', tag: 'CC 会计' };
    if (text.includes('英语') || text.includes('口语')) return { cat: 'study', tag: '英语口语' };
    if (text.includes('回家') || text.includes('假期') || text.includes('机票') || text.includes('高铁')) return { cat: 'life', tag: '假期/回家' };
    if (text.includes('烘焙') || text.includes('烤') || text.includes('派') || text.includes('蛋糕') || text.includes('面包') || text.includes('饼干')) return { cat: 'life', tag: '烘焙' };
    return { cat: 'life', tag: '' };
  }

  function detectBuys(text) {
    const buys = [];
    const re = /(?:买|购买|抢购|代购|下单)([^，。、并和还有然后]{1,12})/g;
    let m;
    while ((m = re.exec(text))) {
      let name = m[1].trim().replace(/(\d+(?:\.\d+)?)(元|块钱|块)$/, '').replace(/^(去|个|点|一些|一个|一套)/, '');
      if (name && !/^(去|给|他|她|我)$/.test(name)) buys.push(name);
    }
    const price = text.match(/[（(]?(\d+(?:\.\d+)?)(元|块钱)[)）]?/);
    return { buys, price: price ? Number(price[1]) : 0 };
  }

  function estimateCost(text, cat, tag) {
    if (cat === 'art' && tag === '美甲') return { cost: 200, pool: 'hobby', reason: '美甲平均 ¥200' };
    if (text.includes('抢购') || /loverboy|palace|supreme|潮牌/i.test(text)) return { cost: 1680, pool: 'street', reason: '潮牌单品参考 ¥1680' };
    if (text.includes('代购')) return { cost: 300, pool: 'hobby', reason: '代购参考 ¥300' };
    if (text.includes('模具') || text.includes('器材') || text.includes('打蛋器') || text.includes('厨师机')) return { cost: 150, pool: 'hobby', reason: '烘焙器材参考 ¥150' };
    return { cost: 0, pool: 'hobby', reason: '' };
  }

  function parseNL(text) {
    const date = parseDate(text);
    const time = parseTime(text);
    const { cat, tag } = detectCat(text);
    const { buys, price } = detectBuys(text);
    const est = estimateCost(text, cat, tag);
    let title = text
      .replace(/(?:下个?)?(?:周|星期)[一二三四五六日天]/, '')
      .replace(/(上午|早上|中午|下午|晚上|凌晨)?\d{1,2}点(?:\d{1,2}分|半|一刻|\d{1,2})?/, '')
      .replace(/(今天|明天|后天)/, '')
      .replace(/(\d{1,2})月(\d{1,2})日/, '')
      .replace(/[去要打算]/, '')
      .replace(/(?:买|购买|抢购|代购|下单)[^，。、并和还有然后]{1,12}/g, '')
      .replace(/[，。、并和还有然后]+/g, '，')
      .replace(/^，|，$/g, '')
      .trim();
    if (!title) title = tag || '待办事项';
    return { title, date, time, cat, tag, buys, price, est, pool: est.pool };
  }

  /* ---------------- .ics ---------------- */
  function toIcs(tasks) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LifeArchitecture//CN', 'CALSCALE:GREGORIAN'];
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    tasks.forEach(t => {
      const d = t.date.replace(/-/g, '');
      const time = (t.time || '').replace(/:/g, '');
      const start = d + (time || 'T000000');
      const end = time ? addMin(t.date, t.time, 60) : d;
      const loc = t.place ? 'LOCATION:' + t.place : '';
      const desc = [t.note, t.cost ? '预计支出 ' + t.cost + '元' : ''].filter(Boolean).join('；');
      lines.push(
        'BEGIN:VEVENT',
        'UID:' + t.id + '@lifearch',
        'DTSTAMP:' + stamp,
        'DTSTART;TZID=Asia/Shanghai:' + start,
        time ? 'DTEND;TZID=Asia/Shanghai:' + end : '',
        'SUMMARY:' + (CAT_EMOJI[t.cat] || '') + t.title,
        loc,
        desc ? 'DESCRIPTION:' + desc : '',
        Number(t.remind) > 0 ? 'BEGIN:VALARM\nACTION:DISPLAY\nDESCRIPTION:提醒\nTRIGGER:-PT' + Number(t.remind) + 'M\nEND:VALARM' : '',
        'END:VEVENT'
      );
    });
    lines.push('END:VCALENDAR');
    return lines.filter(Boolean).join('\r\n');
  }

  function addMin(dateStr, timeStr, mins) {
    const d = new Date(dateStr + 'T' + (timeStr || '00:00'));
    d.setMinutes(d.getMinutes() + mins);
    return ymd(d).replace(/-/g, '') + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
  }

  function icsCodeBlock(task) {
    return `[${task.date} ${task.time || '全天'}] ${task.title}${task.place ? ' @' + task.place : ''}${task.note ? ' /' + task.note : ''}${Number(task.remind) > 0 ? ' /提前' + task.remind + '分钟提醒' : ''}`;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => Finance.toast('已复制 ✓'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      Finance.toast('已复制 ✓');
    }
  }

  function showIcsOutput(task) {
    const el = document.getElementById('pNlPreview');
    el.classList.add('show');
    el.innerHTML = `
      <b>✓ 已加入日程 · 标准 .ics 事件代码：</b>
      <div class="item-sub">${esc(icsCodeBlock(task))}</div>
      <div class="gen-output" id="pIcsCode">${esc(toIcs([task]))}</div>
      <div class="toolbar">
        <button class="btn small" data-copy-ics>复制 .ics 代码</button>
        <button class="btn small ghost" data-dl-ics>下载 .ics 文件</button>
      </div>
      <div class="item-sub">iPhone/iPad：把代码存成 <code>.ics</code> 文件 → 用「日历」App 打开导入；或快捷指令：<code>shortcuts://run-shortcut?name=AddCalendarEvent&input=${encodeURIComponent(icsCodeBlock(task))}</code></div>`;
  }

  /* ---------------- 任务 ---------------- */
  function addTask({ title, date, time, cat, tag, place, note, remind, cost, pool, priority }) {
    S().tasks.push({
      id: Store.uid(), title, date, time: time || '', cat, tag: tag || '',
      place: place || '', note: note || '', remind: Number(remind) || 0,
      done: false, cost: Number(cost) || 0, pool, priority: priority || ''
    });
    Store.save();
  }

  function renderTags() {
    const all = new Set();
    S().tasks.forEach(t => { if (t.tag) all.add(t.tag); });
    document.getElementById('pTagFilter').innerHTML = `<div class="tag-row">
      <button class="tag-chip ${tagFilter === '' ? 'active' : ''}" data-tag="">全部</button>
      ${[...all].map(t => `<button class="tag-chip ${tagFilter === t ? 'active' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
    </div>`;
  }

  function visibleTasks() {
    const base = new Date(); base.setHours(0, 0, 0, 0);
    base.setDate(1);
    base.setMonth(base.getMonth() + calOffset);
    const list = S().tasks.filter(t => (t.date || '').slice(0, 7) === ymd(base).slice(0, 7));
    return (tagFilter ? list.filter(t => t.tag === tagFilter) : list)
      .sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
  }

  function renderCalendar() {
    const base = new Date(); base.setHours(0, 0, 0, 0);
    const first = new Date(base.getFullYear(), base.getMonth() + calOffset, 1);
    const year = first.getFullYear(), month = first.getMonth();
    document.getElementById('pMonthHead').innerHTML = `
      <div class="cal-head">
        <button class="btn tiny ghost" data-moff="-1">‹</button>
        <b>${year}年${month + 1}月</b>
        <button class="btn tiny ghost" data-moff="1">›</button>
      </div>`;
    const startDow = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const tasks = S().tasks;
    const today = ymd(new Date());
    let grid = '<div class="cal-dow">日</div><div class="cal-dow">一</div><div class="cal-dow">二</div><div class="cal-dow">三</div><div class="cal-dow">四</div><div class="cal-dow">五</div><div class="cal-dow">六</div>';
    for (let i = 0; i < startDow; i++) grid += '<div class="cal-day other"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = year + '-' + pad(month + 1) + '-' + pad(d);
      const dayTasks = tasks.filter(t => t.date === dateStr && !t.done);
      grid += `<div class="cal-day ${dateStr === today ? 'today' : ''}">
        <span class="num">${d}</span>
        ${dayTasks.slice(0, 3).map(t => {
          const col = t.priority ? S().priorityColors[t.priority] : S().catColors[t.cat];
          return `<div class="ev" style="border-left-color:${col}">${tagEmoji(t)} ${esc(t.title)}</div>`;
        }).join('')}
        ${dayTasks.length > 3 ? `<div class="ev">+${dayTasks.length - 3}</div>` : ''}
      </div>`;
    }
    const trail = (startDow + daysInMonth) % 7;
    if (trail !== 0) for (let i = 0; i < 7 - trail; i++) grid += '<div class="cal-day other"></div>';
    document.getElementById('pMonthGrid').innerHTML = grid;
    renderTaskList();
  }

  function renderTaskList() {
    renderTags();
    const el = document.getElementById('pTaskList');
    const list = visibleTasks();
    if (!list.length) { el.innerHTML = '<div class="empty">这个月还没有安排。</div>'; return; }
    el.innerHTML = list.map(t => `
      <div class="task-row ${t.done ? 'done' : ''}" data-id="${t.id}">
        <input type="checkbox" class="task-done" ${t.done ? 'checked' : ''}>
        <span class="task-time">${fmtDate(t.date)}${t.time ? ' ' + t.time : ''}</span>
        <span class="task-title">${tagEmoji(t)} ${esc(t.title)}${t.place ? ' · ' + esc(t.place) : ''}${t.note ? ' <span class="item-sub">' + esc(t.note) + '</span>' : ''}</span>
        ${priChip(t)}
        ${t.tag ? tagChip(t.tag) : ''}
        ${t.cost ? `<span class="task-cost">预留 ${Finance.money(t.cost)}</span>` : ''}
        <button class="btn tiny ghost" data-ics="${t.id}">.ics</button>
        <button class="btn tiny" data-expense="${t.id}" ${!t.cost || t.expensed ? 'disabled' : ''}>记支出</button>
        <button class="btn tiny ghost" data-del-task="${t.id}">删</button>
      </div>`).join('');
  }

  function tagEmoji(t) {
    return (t.tag && S().tagEmoji[t.tag]) || CAT_EMOJI[t.cat] || '';
  }

  function tagChip(tag) {
    const color = S().tagColors[tag];
    const style = color ? `style="color:${color};border:1px solid ${color}55;background:${color}14"` : '';
    return `<span class="chip ghost-chip" ${style}>${esc(tag)}</span>`;
  }

  function priChip(t) {
    if (!t.priority) return '';
    const color = S().priorityColors[t.priority] || '#888';
    const label = (window.Theme && Theme.priorityLabel[t.priority]) || t.priority;
    return `<span class="pri-chip" style="background:${color}">${label}</span>`;
  }

  /* ---------------- 联动 ---------------- */
  function confirmTask() {
    const el = document.getElementById('pNlPreview');
    const data = JSON.parse(el.dataset.parsed || '{}');
    const task = {
      title: document.getElementById('pNlTitle').value.trim(),
      date: document.getElementById('pNlDate').value,
      time: document.getElementById('pNlTime').value,
      cat: document.getElementById('pNlCat').value,
      tag: document.getElementById('pNlTag').value,
      place: document.getElementById('pNlPlace').value,
      remind: document.getElementById('pNlRemind').value,
      cost: Number(document.getElementById('pNlCost').value) || 0,
      pool: document.getElementById('pNlPool').value,
      priority: document.getElementById('pNlPriority').value
    };
    addTask(task);
    (data.buys || []).forEach(name => {
      const p = Finance.suggestPool(name);
      Finance.addPending(name, data.price || (p === 'street' ? 1680 : 0), p === 'street' ? '日代' : '店铺', '');
    });
    if (task.cost > 0) {
      const st = Finance.poolStatus(task.pool);
      Finance.toast(`已预留 ${Finance.money(task.cost)}，${Store.POOL_META[task.pool].name} 剩余 ${Finance.money(st.left)}`);
    } else {
      Finance.toast('已加入日程 📅');
    }
    document.getElementById('pNlInput').value = '';
    el.dataset.parsed = '';
    showIcsOutput(task);
    renderAll();
  }

  function showPreview(parsed) {
    const el = document.getElementById('pNlPreview');
    el.dataset.parsed = JSON.stringify({ buys: parsed.buys, price: parsed.price });
    el.classList.add('show');
    const buysHtml = parsed.buys.length ? `<div class="kv"><span>检测到购买</span><b>${parsed.buys.map(esc).join('、')} → 自动进冷静期</b></div>` : '';
    el.innerHTML = `
      <div class="kv"><span>事项</span><input id="pNlTitle" value="${esc(parsed.title)}" style="max-width:260px"></div>
      <div class="kv"><span>日期 / 时间</span>
        <span style="display:flex;gap:6px">
          <input type="date" id="pNlDate" value="${parsed.date}" style="max-width:150px">
          <input type="time" id="pNlTime" value="${parsed.time || '09:00'}" style="max-width:110px">
        </span>
      </div>
      <div class="kv"><span>地点</span><input id="pNlPlace" placeholder="可选" style="max-width:220px"></div>
      <div class="kv"><span>提醒</span>
        <select id="pNlRemind" style="max-width:150px">
          <option value="15">提前 15 分钟</option>
          <option value="30" selected>提前 30 分钟</option>
          <option value="60">提前 1 小时</option>
          <option value="0">不提醒</option>
        </select>
      </div>
      <div class="kv"><span>分类</span>
        <select id="pNlCat" style="max-width:200px">
          ${Object.keys(CAT_NAME).map(c => `<option value="${c}" ${c === parsed.cat ? 'selected' : ''}>${CAT_EMOJI[c]} ${CAT_NAME[c]}</option>`).join('')}
        </select>
      </div>
      <div class="kv"><span>轻重缓急</span>
        <select id="pNlPriority" style="max-width:170px">
          <option value="">不设置</option>
          <option value="p1">🔴 重要且紧急</option>
          <option value="p2">🟢 重要不紧急</option>
          <option value="p3">🟠 紧急不重要</option>
          <option value="p4">⚪ 不重要不紧急</option>
        </select>
      </div>
      <div class="kv"><span>标签</span>
        <select id="pNlTag" style="max-width:160px">
          ${['游泳','国画','美甲','CC 会计','英语口语','烘焙','假期/回家'].map(t => `<option ${t === parsed.tag ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="kv"><span>预计支出 ¥</span><input type="number" id="pNlCost" value="${parsed.est.cost}" min="0" style="max-width:130px"></div>
      <div class="kv"><span>预算池</span>
        <select id="pNlPool" style="max-width:150px">
          <option value="hobby" ${parsed.pool === 'hobby' ? 'selected' : ''}>轻度爱好</option>
          <option value="must" ${parsed.pool === 'must' ? 'selected' : ''}>必须支出</option>
          <option value="street" ${parsed.pool === 'street' ? 'selected' : ''}>潮牌基金</option>
        </select>
      </div>
      ${buysHtml}
      <div class="kv"><span>联动</span><b>${parsed.est.cost > 0 ? '💰 预计 ' + Finance.money(parsed.est.cost) + '，加入日程后自动预留' : buysHtml ? '🛑 购买项进冷静期' : '无消费联动'}</b></div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn" id="pNlConfirm">✓ 加入日程并生成 .ics</button>
        <button class="btn ghost" id="pNlCancel">取消</button>
      </div>`;
    document.getElementById('pNlConfirm').addEventListener('click', confirmTask);
    document.getElementById('pNlCancel').addEventListener('click', () => { el.classList.remove('show'); el.innerHTML = ''; });
  }

  function renderAll() {
    const active = document.querySelector('.view.active');
    if (active && active.id === 'view-planner') renderCalendar();
    if (active && active.id === 'view-dashboard' && window.App) App.renderDashboard();
    if (active && active.id === 'view-finance') Finance.renderFinance();
  }

  function bind() {
    document.getElementById('pNlGo').addEventListener('click', () => {
      const text = document.getElementById('pNlInput').value.trim();
      if (text) showPreview(parseNL(text));
    });
    document.getElementById('pNlInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('pNlGo').click();
    });

    document.getElementById('pTaskForm').addEventListener('submit', e => {
      e.preventDefault();
      const cost = Number(document.getElementById('pTaskCost').value) || 0;
      const pool = document.getElementById('pTaskPool').value;
      const task = {
        title: document.getElementById('pTaskTitle').value.trim(),
        date: document.getElementById('pTaskDate').value,
        time: document.getElementById('pTaskTime').value,
        cat: document.getElementById('pTaskCat').value,
        tag: document.getElementById('pTaskTag').value,
        place: document.getElementById('pTaskPlace').value.trim(),
        note: document.getElementById('pTaskNote').value.trim(),
        remind: document.getElementById('pTaskRemind').value,
        cost, pool, priority: document.getElementById('pTaskPriority').value
      };
      addTask(task);
      e.target.reset();
      document.getElementById('pTaskDate').value = Store.todayStr();
      if (cost > 0) {
        const st = Finance.poolStatus(pool);
        Finance.toast(`已预留 ${Finance.money(cost)}，剩余 ${Finance.money(st.left)}`);
      }
      showIcsOutput(task);
      renderAll();
    });

    document.getElementById('pMonthHead').addEventListener('click', e => {
      const b = e.target.closest('[data-moff]');
      if (b) { calOffset += Number(b.dataset.moff); renderCalendar(); }
    });
    document.getElementById('pTagFilter').addEventListener('click', e => {
      const b = e.target.closest('[data-tag]');
      if (b) { tagFilter = b.dataset.tag; renderCalendar(); }
    });

    document.getElementById('pTaskList').addEventListener('click', e => {
      const row = e.target.closest('.task-row');
      if (!row) return;
      const id = row.dataset.id;
      const task = S().tasks.find(t => t.id === id);
      const del = e.target.closest('[data-del-task]');
      const ex = e.target.closest('[data-expense]');
      const ic = e.target.closest('[data-ics]');
      if (del) {
        S().tasks = S().tasks.filter(t => t.id !== id);
        Store.save();
        renderAll();
      } else if (ex && task && task.cost && !task.expensed) {
        Finance.addExpense({ amount: task.cost, pool: task.pool, cat: Finance.suggestCat(task.pool, task.title), note: task.title + '（日程）', tag: '', reimb: '' });
        task.expensed = true;
        task.cost = 0;
        Store.save();
        renderAll();
        Finance.toast('已转为实际支出 ✓');
      } else if (ic && task) {
        copyText(toIcs([task]));
      }
    });
    document.getElementById('pTaskList').addEventListener('change', e => {
      const cb = e.target.closest('.task-done');
      if (!cb) return;
      const task = S().tasks.find(t => t.id === cb.closest('.task-row').dataset.id);
      if (!task) return;
      task.done = cb.checked;
      if (cb.checked && task.cost && !task.expensed) Finance.toast(`完成！记得点「记支出」`);
      Store.save();
      renderCalendar();
    });

    document.getElementById('pExportIcs').addEventListener('click', () => {
      const base = new Date();
      const m = base.getMonth() + calOffset;
      const tasks = S().tasks.filter(t => {
        const d = new Date(t.date + 'T00:00:00');
        return d.getFullYear() === base.getFullYear() && d.getMonth() === m;
      });
      if (!tasks.length) { Finance.toast('本月没有可导出的安排', true); return; }
      downloadFile('生活架构_' + base.getFullYear() + '-' + pad(m + 1) + '.ics', toIcs(tasks), 'text/calendar;charset=utf-8');
      Finance.toast('已导出 .ics，用「日历」App 打开即可导入 📅');
    });

    document.getElementById('pNlPreview').addEventListener('click', e => {
      const cp = e.target.closest('[data-copy-ics]');
      const dl = e.target.closest('[data-dl-ics]');
      if (cp) copyText(document.getElementById('pIcsCode').textContent);
      if (dl) {
        downloadFile('event.ics', document.getElementById('pIcsCode').textContent, 'text/calendar;charset=utf-8');
      }
    });
  }

  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function init() {
    document.getElementById('pTaskTag').innerHTML = ['游泳', '国画', '美甲', 'CC 会计', '英语口语', '烘焙', '假期/回家'].map(t => `<option>${t}</option>`).join('');
    const date = document.getElementById('pTaskDate');
    if (!date.value) date.value = Store.todayStr();
    bind();
    renderCalendar();
  }

  window.Planner = { init, renderCalendar, renderTaskList, parseNL, toIcs, addTask, icsCodeBlock };
})();
