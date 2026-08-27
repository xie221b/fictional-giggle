/* ============================================================
 * 模块四：自媒体起号与运营
 * ============================================================ */
(function () {
  const S = () => Store.state;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function mediaCopy() {
    const sections = {};
    let cur = null;
    (S().copy.media || '').split('\n').forEach(raw => {
      const l = raw.trim();
      if (!l) return;
      if (l.endsWith('：')) { cur = l.slice(0, -1); sections[cur] = sections[cur] || {}; return; }
      if (!cur) return;
      const i = l.indexOf('：');
      if (i < 0) return;
      sections[cur][l.slice(0, i).trim()] = l.slice(i + 1).trim();
    });
    return sections;
  }

  function suggestSlot(platform) {
    const now = new Date();
    const d = new Date(now);
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); // 下一个周日
    const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const sec = mediaCopy()[platform] || {};
    return { date: dateStr, time: sec['排期时间'] || '20:00', tip: sec['排期提示'] || '' };
  }

  function generate() {
    const platform = document.getElementById('mPlatform').value;
    const type = document.getElementById('mType').value;
    const name = document.getElementById('mName').value.trim();
    const detail = document.getElementById('mDetail').value.trim();
    const out = document.getElementById('mOutput');
    if (!name) { Finance.toast('先填名称', true); return; }
    const sec = mediaCopy()[platform] || {};
    const fill = t => (t || '').replace(/\{name\}/g, name).replace(/\{detail\}/g, detail ? detail + '。' : '');
    const title = fill(sec[type + '标题']);
    const body = fill(sec[type + '正文']);
    const tags = sec[type + '标签'] || '';
    const copy = `标题：${title}\n\n正文：\n${body}`;
    const slot = suggestSlot(platform);
    const full = `${copy}\n\n${tags}\n\n📅 排期建议：${slot.tip}（已加入排期：${slot.date} ${slot.time}）`;
    out.textContent = full;

    S().posts.unshift({
      id: Store.uid(), platform, type, title: name, date: slot.date, time: slot.time,
      tags, status: 'planned'
    });
    Store.save();
    renderSchedule();
    Finance.toast('已生成文案并加入排期');
  }

  function renderShoot() {
    const map = {};
    (S().copy.shoot || '').split('\n').forEach(raw => {
      const l = raw.trim();
      if (!l) return;
      const i = l.indexOf('：');
      if (i < 0) return;
      map[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    });
    const xhs = document.getElementById('mShootXhs');
    const dy = document.getElementById('mShootDy');
    if (xhs) xhs.textContent = map['小红书'] || '';
    if (dy) dy.textContent = map['抖音'] || '';
  }

  function renderSchedule() {
    const el = document.getElementById('mSchedule');
    const list = S().posts;
    if (!list.length) { el.innerHTML = '<div class="empty">还没有排期内容。</div>'; return; }
    el.innerHTML = list.map(p => `
      <div class="expense-row">
        <span class="chip ghost-chip">${esc(p.platform)}</span>
        <span class="task-title">${esc(p.title)}</span>
        <span class="task-time">${p.date.slice(5)} ${p.time || ''}</span>
        <button class="btn tiny ghost" data-del-post="${p.id}">删</button>
      </div>`).join('');
  }

  function renderWatermark() {
    const id = document.getElementById('mWatermark').value.trim() || '@YourID';
    const prev = document.getElementById('mWatermarkPreview');
    prev.textContent = id + ' · 半透明水印预览';
    prev.style.opacity = '0.4';
  }

  function bind() {
    document.getElementById('mGenerate').addEventListener('click', generate);
    document.getElementById('mCopy').addEventListener('click', () => {
      const out = document.getElementById('mOutput');
      if (!out.textContent) return;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(out.textContent).then(() => Finance.toast('已复制全文 ✓'));
      } else {
        const ta = document.createElement('textarea');
        ta.value = out.textContent;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        Finance.toast('已复制全文 ✓');
      }
    });
    document.getElementById('mSchedule').addEventListener('click', e => {
      const del = e.target.closest('[data-del-post]');
      if (del) {
        S().posts = S().posts.filter(p => p.id !== del.dataset.delPost);
        Store.save();
        renderSchedule();
      }
    });
    document.getElementById('mWatermark').addEventListener('input', renderWatermark);
  }

  window.Media = {
    init() { bind(); renderSchedule(); renderWatermark(); renderShoot(); },
    generate, renderSchedule, renderShoot, mediaCopy
  };
})();
