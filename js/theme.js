/* ============================================================
 * 外观：主题色 / 背景 / 模块与标签颜色表情 / 轻重缓急分色
 * ============================================================ */
(function () {
  const S = () => Store.state;

  const THEMES = {
    paper: {
      label: '护眼纸', desc: '暖米色 · 柔和护眼',
      vars: {
        '--bg': '#F4F1EA', '--card': '#FFFDF8', '--ink': '#2E2A24', '--gray': '#7A746A',
        '--light': '#ECE8DF', '--line': '#E2DCD0', '--dark': '#2E2A24',
        '--accent': '#4A6B53', '--accent-soft': '#E4EDE6', '--on-accent': '#FFFFFF',
        '--danger': '#B0563F', '--warn': '#C68A2E', '--info': '#4A6FA5', '--purple': '#6B5B95',
        '--p1': '#C0392B', '--p2': '#2E7D5B', '--p3': '#D9822B', '--p4': '#8A8A8E'
      }
    },
    green: {
      label: '墨绿宁静', desc: '低饱和绿 · 护眼',
      vars: {
        '--bg': '#EEF1EB', '--card': '#FBFCF8', '--ink': '#28352C', '--gray': '#707A70',
        '--light': '#E2E8E0', '--line': '#D6DED3', '--dark': '#28352C',
        '--accent': '#3E5C4A', '--accent-soft': '#E0EAE2', '--on-accent': '#FFFFFF',
        '--danger': '#A65341', '--warn': '#B98A2F', '--info': '#47658C', '--purple': '#66558A',
        '--p1': '#C0392B', '--p2': '#2E7D5B', '--p3': '#D9822B', '--p4': '#8A8A8E'
      }
    },
    blue: {
      label: '雾蓝清爽', desc: '冷静蓝灰',
      vars: {
        '--bg': '#EEF2F6', '--card': '#FBFCFE', '--ink': '#2A3038', '--gray': '#6F7883',
        '--light': '#E3E9F0', '--line': '#D8E0E8', '--dark': '#2A3038',
        '--accent': '#33506B', '--accent-soft': '#DFE8F1', '--on-accent': '#FFFFFF',
        '--danger': '#A6534B', '--warn': '#B3862F', '--info': '#33506B', '--purple': '#6A5B8C',
        '--p1': '#C0392B', '--p2': '#2E7D5B', '--p3': '#D9822B', '--p4': '#8A8A8E'
      }
    },
    ink: {
      label: '纯黑白', desc: 'Apple 极简原版',
      vars: {
        '--bg': '#FFFFFF', '--card': '#FFFFFF', '--ink': '#000000', '--gray': '#6E6E73',
        '--light': '#F2F2F7', '--line': '#E5E5EA', '--dark': '#1C1C1E',
        '--accent': '#000000', '--accent-soft': '#F2F2F7', '--on-accent': '#FFFFFF',
        '--danger': '#B3261E', '--warn': '#B3261E', '--info': '#1C1C1E', '--purple': '#1C1C1E',
        '--p1': '#B3261E', '--p2': '#1C1C1E', '--p3': '#6E6E73', '--p4': '#AEAEB2'
      }
    }
  };

  const BG_PRESETS = [
    { label: '晨雾', css: 'linear-gradient(160deg, #E8EDE6, #C9D6CB)' },
    { label: '奶油', css: 'linear-gradient(160deg, #F6EFE6, #E9DCCB)' },
    { label: '暮蓝', css: 'linear-gradient(160deg, #DEE7F0, #BECFE0)' },
    { label: '浅紫', css: 'linear-gradient(160deg, #ECE7F2, #D8CFE5)' },
    { label: '浅粉', css: 'linear-gradient(160deg, #F6E7E7, #E8D0D0)' },
    { label: '薄荷', css: 'linear-gradient(160deg, #E1F0EA, #C4E0D4)' },
    { label: '燕麦', css: 'linear-gradient(160deg, #F2EDE4, #E2D8C6)' },
    { label: '灰蓝', css: 'linear-gradient(160deg, #E9EDF1, #D4DCE4)' }
  ];

  const EMOJIS = ['🏊', '🎨', '💅', '📖', '🗣️', '🥧', '🧳', '🍰', '🐻', '🌸', '✨', '🔥', '☕', '📷', '🧁', '🍎', '🐰', '⭐'];

  const COLOR_KEYS = [
    ['--bg', '背景色'], ['--card', '卡片色'], ['--ink', '文字色'], ['--accent', '主色'],
    ['--accent-soft', '主色浅底'], ['--danger', '强调红'], ['--warn', '强调橙'],
    ['--info', '强调蓝'], ['--purple', '强调紫']
  ];

  function applyTheme() {
    const t = S().theme;
    const base = (THEMES[t.preset] || THEMES.paper).vars;
    const vars = Object.assign({}, base, t.custom || {});
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', vars['--bg'] || '#F4F1EA');
  }

  function applyBackground() {
    const b = S().background;
    const root = document.documentElement;
    if (!b || b.type === 'none' || !b.value) {
      root.style.setProperty('--bg-image', 'none');
    } else if (b.type === 'preset') {
      root.style.setProperty('--bg-image', b.value);
    } else {
      root.style.setProperty('--bg-image', `url("${String(b.value).replace(/["']/g, '')}")`);
    }
  }

  function applyAll() {
    applyTheme();
    applyBackground();
  }

  /* ---------------- 外观面板 ---------------- */
  function renderThemes() {
    const t = S().theme;
    document.getElementById('aThemeGrid').innerHTML = Object.entries(THEMES).map(([key, th]) => {
      const g = `linear-gradient(135deg, ${th.vars['--bg']}, ${th.vars['--accent']})`;
      return `<button class="theme-card ${t.preset === key ? 'active' : ''}" data-theme="${key}">
        <div class="theme-swatch" style="background:${g}"></div>
        ${th.label}<br><span style="font-weight:400;color:var(--gray)">${th.desc}</span>
      </button>`;
    }).join('');
  }

  function renderColors() {
    const t = S().theme;
    const base = (THEMES[t.preset] || THEMES.paper).vars;
    document.getElementById('aColors').innerHTML = COLOR_KEYS.map(([k, label]) => {
      const v = t.custom[k] || base[k];
      return `<div class="color-row"><label>${label}</label>
        <input type="color" data-var="${k}" value="${v}"></div>`;
    }).join('');
  }

  function renderBackground() {
    const b = S().background;
    document.getElementById('aBgType').value = b.type;
    document.getElementById('aBgUrl').value = b.type === 'url' ? b.value : '';
    document.getElementById('aBgOpacity').value = b.opacity;
    const hint = {
      none: '无背景', preset: '内置图库', image: '已上传本地图片', url: '图片链接'
    };
    document.getElementById('aBgHint').textContent = '当前：' + (hint[b.type] || '无背景');
    document.getElementById('aBgGallery').innerHTML = BG_PRESETS.map(p =>
      `<div class="bg-item ${b.type === 'preset' && b.value === p.css ? 'active' : ''}" data-css="${p.css}" title="${p.label}" style="background:${p.css}"></div>`
    ).join('');
  }

  function renderCatTags() {
    const st = S();
    const cats = [['sports', '体育运动'], ['art', '艺术兴趣'], ['study', '学习与专业'], ['life', '生活休闲']];
    const emojiQuick = EMOJIS.map(e => `<button class="emoji-btn" data-emoji="${e}">${e}</button>`).join('');
    document.getElementById('aCatRows').innerHTML = '<p class="muted" style="margin-top:0">模块颜色：</p>' + cats.map(([k, name]) => `
      <div class="color-row">
        <label>${name}</label>
        <input type="color" data-cat="${k}" value="${st.catColors[k] || '#888'}">
      </div>`).join('');
    document.getElementById('aTagRows').innerHTML = '<p class="muted">标签颜色与表情（点表情直接选用）：</p>' + Object.keys(Store.TAGS).reduce((acc, cat) =>
      acc + Store.TAGS[cat].map(tag => `
        <div class="color-row">
          <label>${tag}</label>
          <input class="tag-emoji" data-tag="${tag}" value="${st.tagEmoji[tag] || ''}" style="width:52px;text-align:center">
          <input type="color" data-tagc="${tag}" value="${st.tagColors[tag] || '#888'}">
        </div>`).join('')
    , '') + `<div class="emoji-row">${emojiQuick}</div>`;
  }

  function saveAppearance() {
    const st = S();
    const preset = document.querySelector('.theme-card.active');
    if (preset) st.theme.preset = preset.dataset.theme;
    st.theme.custom = {};
    document.querySelectorAll('#aColors input[type=color]').forEach(inp => {
      st.theme.custom[inp.dataset.var] = inp.value;
    });
    document.querySelectorAll('#aCatRows input[data-cat]').forEach(inp => {
      st.catColors[inp.dataset.cat] = inp.value;
    });
    document.querySelectorAll('#aTagRows input[data-tag]').forEach(inp => {
      st.tagEmoji[inp.dataset.tag] = inp.value;
    });
    document.querySelectorAll('#aTagRows input[data-tagc]').forEach(inp => {
      st.tagColors[inp.dataset.tagc] = inp.value;
    });
    Store.save();
    applyAll();
    Finance.toast('外观已保存 🎨');
    refreshPlanner();
  }

  function savePriority() {
    const st = S();
    document.querySelectorAll('[data-pri]').forEach(inp => {
      st.priorityColors[inp.dataset.pri] = inp.value;
    });
    applyTheme();
    Store.save();
    Finance.toast('轻重缓急颜色已保存');
    refreshPlanner();
  }

  function refreshPlanner() {
    if (document.getElementById('view-planner').classList.contains('active') && window.Planner) Planner.renderCalendar();
    if (document.getElementById('view-dashboard').classList.contains('active') && window.App) App.renderDashboard();
  }

  function resizeImage(file, cb) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1600;
        let w = img.width, h = img.height;
        if (w > max) { h = h * max / w; w = max; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function bind() {
    document.getElementById('aThemeGrid').addEventListener('click', e => {
      const b = e.target.closest('[data-theme]');
      if (!b) return;
      document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
      b.classList.add('active');
      S().theme.preset = b.dataset.theme;
      S().theme.custom = {};
      applyAll();
      renderColors();
    });

    document.getElementById('aSave').addEventListener('click', saveAppearance);
    document.getElementById('aReset').addEventListener('click', () => {
      if (!window.confirm('恢复默认外观（主题/背景/标签颜色）？')) return;
      const d = Store.defaults;
      S().theme = JSON.parse(JSON.stringify(d.theme));
      S().background = JSON.parse(JSON.stringify(d.background));
      S().tagColors = JSON.parse(JSON.stringify(d.tagColors));
      S().tagEmoji = JSON.parse(JSON.stringify(d.tagEmoji));
      S().catColors = JSON.parse(JSON.stringify(d.catColors));
      S().priorityColors = JSON.parse(JSON.stringify(d.priorityColors));
      Store.save();
      renderAll();
      applyAll();
      refreshPlanner();
      Finance.toast('已恢复默认外观');
    });

    document.getElementById('aBgType').addEventListener('change', e => {
      S().background.type = e.target.value;
      if (e.target.value === 'image' && S().background.type === 'image') {
        document.getElementById('aBgFile').click();
      }
      if (e.target.value !== 'image') { renderBackground(); applyBackground(); }
    });
    document.getElementById('aBgGallery').addEventListener('click', e => {
      const b = e.target.closest('[data-css]');
      if (!b) return;
      S().background.type = 'preset';
      S().background.value = b.dataset.css;
      applyBackground();
      renderBackground();
    });
    document.getElementById('aBgUpload').addEventListener('click', () => document.getElementById('aBgFile').click());
    document.getElementById('aBgFile').addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      resizeImage(f, dataUrl => {
        if (dataUrl.length > 2.6e6) { Finance.toast('图片太大，请换小一点的图', true); return; }
        S().background.type = 'image';
        S().background.value = dataUrl;
        Store.save();
        applyBackground();
        renderBackground();
        Finance.toast('背景已应用 🖼️');
      });
      e.target.value = '';
    });
    document.getElementById('aBgUrl').addEventListener('change', e => {
      const url = e.target.value.trim();
      if (!url) return;
      S().background.type = 'url';
      S().background.value = url;
      Store.save();
      applyBackground();
      renderBackground();
      Finance.toast('已应用图片链接背景');
    });
    document.getElementById('aBgOpacity').addEventListener('input', e => {
      S().background.opacity = Number(e.target.value);
      Store.save();
    });

    document.getElementById('aTagRows').addEventListener('click', e => {
      const b = e.target.closest('[data-emoji]');
      if (!b) return;
      const input = document.getElementById('aTagRows').querySelector('.tag-emoji');
      if (input) input.value = b.dataset.emoji;
    });

    document.getElementById('aSavePri').addEventListener('click', savePriority);
  }

  function renderAll() {
    renderThemes();
    renderColors();
    renderBackground();
    renderCatTags();
    document.querySelectorAll('[data-pri]').forEach(inp => {
      inp.value = S().priorityColors[inp.dataset.pri] || '#888';
    });
  }

  window.Theme = {
    init() { bind(); renderAll(); applyAll(); },
    applyAll, applyTheme, applyBackground, renderAll,
    priorityLabel: { p1: '重要且紧急', p2: '重要不紧急', p3: '紧急不重要', p4: '不重要不紧急' }
  };
})();
