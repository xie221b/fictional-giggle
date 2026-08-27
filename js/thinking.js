/* ============================================================
 * 模块五：口语训练与深度思考空间
 * ============================================================ */
(function () {
  const S = () => Store.state;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function questions() {
    return (S().copy.questions || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const i = l.indexOf('|');
      return { topic: (i > 0 ? l.slice(0, i) : '人生').trim(), q: (i > 0 ? l.slice(i + 1) : l).trim() };
    });
  }

  function topics() {
    const map = {};
    questions().forEach(x => { if (!map[x.topic]) map[x.topic] = []; map[x.topic].push(x); });
    return map;
  }

  function fillers() {
    return (S().copy.fillers || '').split('\n').map(x => x.trim()).filter(Boolean);
  }

  let qList = null;
  let qIndex = null;

  function questionOfDay() {
    qList = questions();
    if (!qList.length) return { topic: '人生', q: '今天想思考什么？' };
    const day = Math.floor(Date.now() / 86400000);
    qIndex = day % qList.length;
    return qList[qIndex];
  }

  function renderQuestion(q) {
    document.getElementById('tQuestion').textContent = q.q;
  }

  function renderTopics() {
    document.getElementById('tTopics').innerHTML = Object.keys(topics()).map(t =>
      `<button class="tag-chip" data-topic="${t}">${t}</button>`).join('');
  }

  function renderLog() {
    const list = [...S().thinkLog].reverse();
    const el = document.getElementById('tLog');
    if (!list.length) { el.innerHTML = '<div class="empty">今天还没行动。想完，动一下。</div>'; return; }
    el.innerHTML = list.slice(0, 10).map(x => `
      <div class="expense-row"><span class="item-sub">${x.date}</span><span>${esc(x.action)}</span></div>`).join('');
  }

  function streak() {
    const days = new Set(S().thinkLog.map(x => x.date));
    let n = 0;
    const d = new Date();
    while (true) {
      const s = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (!days.has(s)) break;
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function checkin() {
    const action = document.getElementById('tAction').value;
    S().thinkLog.push({ date: Store.todayStr(), action });
    Store.save();
    const el = document.getElementById('tStreak');
    el.classList.add('show');
    el.innerHTML = `✅ 已打卡：${action}\n连续行动 ${streak()} 天。身体动起来，状态才会跟着转。`;
    renderLog();
    Finance.toast('打卡成功，保持 🏃');
  }

  /* ---------------- 英语教练 ---------------- */
  function coach() {
    const cn = document.getElementById('tCnInput').value.trim();
    const out = document.getElementById('tCoachOut');
    if (!cn) { out.textContent = '输入一段你的中文表达。'; return; }
    const FILLERS = fillers();
    const stats = {};
    FILLERS.forEach(f => { const c = cn.split(f).length - 1; if (c) stats[f] = c; });
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    let cleaned = cn;
    FILLERS.forEach(f => { cleaned = cleaned.split(f).join(''); });
    cleaned = cleaned.replace(/[，。]\s*[，。]+/g, '，').replace(/^[，。]|[，。]$/g, '');
    const topic = cleaned.replace(/[，。！？、\s]/g, ' ').split(' ').filter(Boolean).slice(0, 6).join(' ');
    const skeleton = (S().copy.skeleton || '').replace(/\{topic\}/g, topic || 'this');
    out.textContent = `填充词统计：${total ? Object.entries(stats).map(([k, v]) => `${k} ×${v}`).join('、') : '很干净，一个都没有 🎉'}\n\n干净版中文：\n${cleaned}\n\n英语逻辑骨架（对着这个结构说）：\n${skeleton}`;
  }

  function renderWords() {
    const el = document.getElementById('tWords');
    const list = S().words;
    if (!list.length) { el.innerHTML = '<div class="empty">还没有词汇。</div>'; return; }
    el.innerHTML = `<table class="table">
      <tr><th>中文</th><th>English</th><th></th></tr>
      ${list.map(w => `<tr><td>${esc(w.cn)}</td><td>${esc(w.en)}</td><td><button class="btn tiny ghost" data-del-word="${w.id}">删</button></td></tr>`).join('')}
    </table>`;
  }

  function bind() {
    document.getElementById('tCheckin').addEventListener('click', checkin);
    document.getElementById('tNext').addEventListener('click', () => {
      const list = questions();
      if (!list.length) return;
      qIndex = ((qIndex == null ? 0 : qIndex) + 1) % list.length;
      renderQuestion(list[qIndex]);
    });
    document.getElementById('tTopics').addEventListener('click', e => {
      const b = e.target.closest('[data-topic]');
      if (!b) return;
      const pool = topics()[b.dataset.topic] || [];
      if (!pool.length) return;
      const q = pool[Math.floor(Math.random() * pool.length)];
      renderQuestion(q);
    });
    document.getElementById('tCoach').addEventListener('click', coach);
    document.getElementById('tWordForm').addEventListener('submit', e => {
      e.preventDefault();
      S().words.push({
        id: Store.uid(),
        cn: document.getElementById('tWordCn').value.trim(),
        en: document.getElementById('tWordEn').value.trim()
      });
      Store.save();
      e.target.reset();
      renderWords();
      Finance.toast('词汇已添加');
    });
    document.getElementById('tWords').addEventListener('click', e => {
      const del = e.target.closest('[data-del-word]');
      if (del) {
        S().words = S().words.filter(w => w.id !== del.dataset.delWord);
        Store.save();
        renderWords();
      }
    });
  }

  window.Thinking = {
    init() {
      bind();
      renderQuestion(questionOfDay());
      renderTopics();
      renderLog();
      renderWords();
      const el = document.getElementById('tStreak');
      if (streak() > 0) {
        el.classList.add('show');
        el.innerHTML = `连续行动 ${streak()} 天，保持住。`;
      }
    },
    streak,
    refresh() {
      renderQuestion(questionOfDay());
      renderTopics();
      renderLog();
      renderWords();
    }
  };
})();
