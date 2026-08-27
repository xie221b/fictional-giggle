/* ============================================================
 * 模块二：烘焙与库存工坊
 * ============================================================ */
(function () {
  const S = () => Store.state;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const money = n => '¥' + (Number(n) || 0).toLocaleString('zh-CN');

  function daysTo(expiry) {
    if (!expiry) return 999;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const e = new Date(expiry + 'T00:00:00');
    return Math.round((e - now) / 86400000);
  }

  function expiryChip(expiry) {
    const d = daysTo(expiry);
    if (d < 0) return '<span class="chip">已过期 ' + (-d) + ' 天</span>';
    if (d === 0) return '<span class="chip">今天到期</span>';
    if (d <= 7) return '<span class="chip">临期 ' + d + ' 天</span>';
    if (d <= 30) return '<span class="chip ghost-chip">' + d + ' 天后到期</span>';
    return '<span class="chip ghost-chip">可存放</span>';
  }

  /* ---------------- 配方库 ---------------- */
  function ingRow(name, amount, unit) {
    const div = document.createElement('div');
    div.className = 'inline-form';
    div.style.margin = '0 0 6px';
    div.innerHTML = `
      <input class="ing-name" placeholder="原料" value="${esc(name || '')}">
      <input class="ing-amount" placeholder="用量" value="${esc(amount || '')}" style="max-width:88px">
      <select class="ing-unit">
        ${['克','千克','个','盒','袋','瓶','毫升','片'].map(u => `<option ${u === (unit || '克') ? 'selected' : ''}>${u}</option>`).join('')}
      </select>
      <button type="button" class="btn tiny ghost ing-del">✕</button>`;
    div.querySelector('.ing-del').addEventListener('click', () => div.remove());
    return div;
  }

  function renderRecipeForm() {
    const wrap = document.getElementById('bIngRows');
    wrap.innerHTML = '';
    [['面粉', '250', '克'], ['苹果', '4', '个'], ['黄油', '120', '克']].forEach(([n, a, u]) => wrap.appendChild(ingRow(n, a, u)));
  }

  function saveRecipe() {
    const ingredients = [...document.querySelectorAll('#bIngRows .inline-form')].map(r => ({
      name: r.querySelector('.ing-name').value.trim(),
      amount: r.querySelector('.ing-amount').value.trim(),
      unit: r.querySelector('.ing-unit').value
    })).filter(i => i.name);
    const title = document.getElementById('bRecTitle').value.trim();
    if (!title) { Finance.toast('请填配方名称', true); return; }
    if (!ingredients.length) { Finance.toast('至少填一种原料', true); return; }
    S().recipes.unshift({
      id: Store.uid(), title,
      createdAt: Store.todayStr(),
      source: document.getElementById('bRecSource').value,
      link: document.getElementById('bRecLink').value.trim(),
      servings: Number(document.getElementById('bRecServings').value) || 1,
      ingredients,
      steps: document.getElementById('bRecSteps').value.split('\n').map(x => x.trim()).filter(Boolean),
      equipment: document.getElementById('bRecEquip').value.split(/[,，]/).map(x => x.trim()).filter(Boolean),
      note: document.getElementById('bRecNote').value.trim()
    });
    Store.save();
    document.getElementById('bRecipeForm').reset();
    renderRecipeForm();
    renderRecipes();
    renderUseupPick();
    Finance.toast('配方已保存 📚');
  }

  function renderRecipes() {
    const q = (document.getElementById('bRecSearch').value || '').trim().toLowerCase();
    let list = S().recipes;
    if (q) list = list.filter(r => (r.title + r.source + r.ingredients.map(i => i.name).join('')).toLowerCase().includes(q));
    const el = document.getElementById('bRecipeList');
    if (!list.length) { el.innerHTML = '<div class="empty">还没有配方。</div>'; return; }
    el.innerHTML = list.map(r => `
      <div class="recipe-card">
        <div class="item-head">
          <div>
            <h4>${esc(r.title)} <span class="chip ghost-chip">${esc(r.source)}</span> <span class="chip ghost-chip">${r.servings} 人份</span></h4>
            <div class="recipe-meta">${r.link ? '<a href="' + esc(r.link) + '" target="_blank" rel="noopener">素材原链接 ↗</a>' : ''}</div>
          </div>
          <div class="item-actions"><button class="btn tiny ghost" data-del-recipe="${r.id}">删</button></div>
        </div>
        <div class="ing-line">🧺 ${r.ingredients.map(i => `${esc(i.name)} ${esc(i.amount)}${i.unit}`).join(' · ')}</div>
        ${r.steps.length ? `<div class="recipe-meta" style="margin-top:5px">📋 ${esc(r.steps.join(' → '))}</div>` : ''}
        ${r.equipment.length ? `<div class="recipe-meta">🔧 ${r.equipment.map(esc).join(' · ')}</div>` : ''}
        ${r.note ? `<div class="recipe-meta">✏️ 自改心得：${esc(r.note)}</div>` : ''}
      </div>`).join('');
  }

  /* ---------------- 按配方扣减 ---------------- */
  let pendingDeduct = null;

  function coreName(title) {
    return ['经典', '自制', '完美', '新手', '超简单', '零失败', '入门', '快手']
      .reduce((t, w) => t.replace(w, ''), title || '');
  }

  function findRecipe(text) {
    const t = (text || '');
    const exact = S().recipes.find(r => t.includes(r.title));
    if (exact) return exact;
    const core = S().recipes.find(r => {
      const c = coreName(r.title);
      return c.length >= 2 && t.includes(c);
    });
    if (core) return core;
    return S().recipes.find(r => {
      const c = coreName(r.title);
      for (let i = 0; i + 2 <= c.length; i++) {
        if (t.includes(c.slice(i, i + 2))) return true;
      }
      return false;
    }) || null;
  }

  function planDeduct() {
    const text = document.getElementById('bDeductInput').value.trim();
    const el = document.getElementById('bDeductResult');
    el.classList.add('show');
    if (!text) { el.innerHTML = '输入你做了什么，例：我今天严格按配方做了一个苹果派。'; return; }
    const recipe = findRecipe(text);
    if (!recipe) {
      el.innerHTML = `没识别到配方。当前配方库：${S().recipes.map(r => r.title).join('、') || '（空）'}`;
      return;
    }
    const lines = [];
    const rows = [];
    recipe.ingredients.forEach(ig => {
      const inv = S().inventory.find(i => i.name.includes(ig.name) || ig.name.includes(i.name));
      if (!inv) {
        lines.push(`· ${ig.name}：库存里没有，先到「原料库存」入库`);
      } else if (inv.unit !== ig.unit) {
        lines.push(`· ${ig.name}：用量 ${ig.amount}${ig.unit}，库存 ${inv.qty}${inv.unit}（单位不同，请手动调整）`);
      } else {
        const remain = Number(inv.qty) - Number(ig.amount);
        rows.push({ inv, remain });
        lines.push(`· ${ig.name}：扣 ${ig.amount}${ig.unit} → 剩 ${remain}${inv.unit}${remain < 0 ? '（不足，将清零并提示补货）' : ''}`);
      }
    });
    pendingDeduct = { recipe, rows, lines };
    el.innerHTML = `<b>「${esc(recipe.title)}」扣减预览</b>\n${lines.join('\n')}`;
    el.innerHTML += `<div class="toolbar"><button class="btn small" data-apply-deduct>确认扣减</button></div>`;
  }

  function applyDeduct() {
    if (!pendingDeduct) return;
    const { recipe, rows } = pendingDeduct;
    rows.forEach(({ inv, remain }) => {
      inv.qty = Math.max(0, Number(remain));
    });
    const zero = rows.filter(({ inv }) => Number(inv.qty) === 0).map(({ inv }) => inv);
    S().inventory = S().inventory.filter(i => !zero.includes(i));
    Store.save();
    pendingDeduct = null;
    document.getElementById('bDeductInput').value = '';
    document.getElementById('bDeductResult').classList.remove('show');
    S().bakeLog.push({ date: Store.todayStr(), title: recipe.title });
    renderInventory();
    Finance.toast(`已按「${recipe.title}」扣减库存 ✓`);
  }

  /* ---------------- 库存 ---------------- */
  function renderInventory() {
    const list = [...S().inventory].sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'));
    const el = document.getElementById('bInventory');
    if (!list.length) { el.innerHTML = '<div class="empty">冰箱是空的，把常备原料录进来。</div>'; return; }
    el.innerHTML = list.map(i => `
      <div class="inv-row">
        <span class="inv-name">${esc(i.name)}</span>
        <span class="item-sub">${i.qty}${i.unit}</span>
        ${expiryChip(i.expiry)}
        <span class="inv-meta">${esc(i.cat)} · ${i.expiry.slice(5)}</span>
        <button class="btn tiny ghost" data-del-inv="${i.id}">删</button>
      </div>`).join('');
    renderUseupPick();
  }

  function addInv(e) {
    e.preventDefault();
    S().inventory.push({
      id: Store.uid(),
      name: document.getElementById('bInvName').value.trim(),
      qty: document.getElementById('bInvQty').value,
      unit: document.getElementById('bInvUnit').value,
      expiry: document.getElementById('bInvExpiry').value,
      cat: document.getElementById('bInvCat').value
    });
    Store.save();
    e.target.reset();
    renderInventory();
    Finance.toast('已入库 🥛');
  }

  /* ---------------- 临期消耗 ---------------- */
  function renderUseupPick() {
    const list = [...S().inventory].sort((a, b) => (a.expiry || '').localeCompare(b.expiry || ''));
    const el = document.getElementById('bUseupPick');
    if (!list.length) { el.innerHTML = '<div class="empty">先录入库存。</div>'; return; }
    el.innerHTML = list.map(i => {
      const d = daysTo(i.expiry);
      const hot = d <= 7 ? ' · 临期' : '';
      return `<label class="check"><input type="checkbox" value="${i.id}" ${d <= 7 ? 'checked' : ''}> ${esc(i.name)}（${i.qty}${i.unit}${hot}）</label>`;
    }).join('');
  }

  function recommendUseup() {
    const picked = [...document.querySelectorAll('#bUseupPick input:checked')].map(c => c.value);
    const items = S().inventory.filter(i => picked.includes(i.id));
    const el = document.getElementById('bUseupResult');
    el.classList.add('show');
    if (!items.length) { el.innerHTML = '先勾选要消耗的食材。'; return; }
    const names = items.map(i => i.name);
    const scored = S().recipes.map(r => {
      const cover = r.ingredients.filter(ig => names.some(n => ig.name.includes(n) || n.includes(ig.name)));
      return { recipe: r, cover, score: cover.length };
    }).sort((a, b) => b.score - a.score);
    const best = scored.filter(x => x.score > 0).slice(0, 3);
    if (!best.length) {
      const tips = items.map(i => tipFor(i.name)).filter(Boolean);
      el.innerHTML = `没有完全匹配的配方，快速消耗思路：\n${tips.join('\n') || '冷冻保存或做成酱/馅料延长保质期。'}`;
      return;
    }
    el.innerHTML = best.map(({ recipe, cover }) => {
      const consume = cover.map(c => {
        const inv = items.find(i => i.name.includes(c.name) || c.name.includes(i.name));
        return `${c.name} 用 ${c.amount}${c.unit}${inv ? `（库存 ${inv.qty}${inv.unit}）` : ''}`;
      }).join(' · ');
      return `• ${recipe.title}（${recipe.source}）\n  消耗：${consume}`;
    }).join('\n\n') + '\n\n（无压力提醒：想做再做，不想做就冷冻食材）';
  }

  function tipFor(name) {
    const map = {};
    (S().copy.useupTips || '').split('\n').forEach(raw => {
      const l = raw.trim();
      if (!l) return;
      const i = l.indexOf('|');
      if (i < 0) return;
      map[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    });
    return map[name] || `「${name}」先搜小红书/抖音的消耗做法`;
  }

  /* ---------------- 器材与进阶 ---------------- */
  function renderEquipment() {
    const el = document.getElementById('bEquipment');
    const list = S().equipment;
    if (!list.length) { el.innerHTML = '<div class="empty">还没有器材记录。</div>'; return; }
    el.innerHTML = list.map(x => `
      <div class="inv-row">
        <label class="check" style="margin:0"><input type="checkbox" data-owned="${x.id}" ${x.owned ? 'checked' : ''}></label>
        <span class="inv-name" style="${x.owned ? '' : 'font-weight:400'}">${esc(x.name)}</span>
        ${x.pro ? '<span class="chip">进阶</span>' : ''}
        <span class="chip ghost-chip">${x.for}</span>
        <span class="chip ${x.owned ? '' : 'ghost-chip'}">${x.owned ? '已有' : x.price ? money(x.price) : '待购'}</span>
        <span class="inv-meta"><button class="btn tiny ghost" data-del-equip="${x.id}">删</button></span>
      </div>`).join('');
  }

  function addEquip(e) {
    e.preventDefault();
    S().equipment.push({
      id: Store.uid(),
      name: document.getElementById('bEquipName').value.trim(),
      owned: document.getElementById('bEquipOwned').checked,
      price: Number(document.getElementById('bEquipPrice').value) || 0,
      for: document.getElementById('bEquipFor').value || '通用',
      pro: document.getElementById('bEquipFor').value !== '' && !document.getElementById('bEquipOwned').checked && Number(document.getElementById('bEquipPrice').value) >= 800
    });
    Store.save();
    e.target.reset();
    renderEquipment();
    Finance.toast('器材已记录 🔧');
  }

  function calcNeed() {
    const name = document.getElementById('bNeedName').value.trim();
    const el = document.getElementById('bNeedResult');
    el.classList.add('show');
    if (!name) { el.innerHTML = '输入品类（如：披萨）或配方名（如：苹果派）。'; return; }
    const recipe = S().recipes.find(r => r.title.includes(name));
    let need = [], have = [], pro = [];
    if (recipe) {
      const owned = new Set(S().equipment.filter(x => x.owned).map(x => x.name));
      need = recipe.equipment.filter(eq => !owned.has(eq));
      have = recipe.equipment.filter(eq => owned.has(eq));
    } else {
      const ownedNames = new Set(S().equipment.filter(x => x.owned).map(x => x.name));
      S().equipment.filter(x => !x.owned && !x.pro && (x.for.includes(name) || name.includes(x.for))).forEach(x => need.push(x.name));
      S().equipment.filter(x => x.pro && (x.for.includes(name) || name.includes(x.for))).forEach(x => pro.push(x));
      have = S().equipment.filter(x => x.owned && (x.for.includes(name) || name.includes(x.for))).map(x => x.name);
    }
    const priceSum = need.reduce((a, n) => {
      const it = S().equipment.find(x => x.name === n);
      return a + (it ? Number(it.price || 0) : 0);
    }, 0);
    let out = recipe
      ? `做「${recipe.title}」\n✅ 已有：${have.join('、') || '—'}\n`
      : `想做「${name}」\n✅ 已有：${have.join('、') || '—'}\n`;
    if (need.length) {
      out += `🛒 还缺：${need.join('、')}${priceSum ? `（参考合计 ${money(priceSum)}）` : ''}\n`;
      out += `   建议先进 24 小时冷静期，别急着下单。`;
    } else {
      out += '🎉 器材齐全，直接开做。';
    }
    if (pro.length) {
      out += `\n\n进阶种草（按需，非必需）：\n${pro.map(x => `· ${x.name} ${money(x.price)} —— 做${x.for}省力/出品更稳`).join('\n')}`;
    }
    el.innerHTML = out.replace(/\n/g, '<br>');
  }

  function bind() {
    document.getElementById('bAddIng').addEventListener('click', () => {
      document.getElementById('bIngRows').appendChild(ingRow('', '', '克'));
    });
    document.getElementById('bRecipeForm').addEventListener('submit', e => { e.preventDefault(); saveRecipe(); });
    document.getElementById('bRecSearch').addEventListener('input', renderRecipes);
    document.getElementById('bRecipeList').addEventListener('click', e => {
      const del = e.target.closest('[data-del-recipe]');
      if (del) {
        S().recipes = S().recipes.filter(r => r.id !== del.dataset.delRecipe);
        Store.save();
        renderRecipes();
      }
    });

    document.getElementById('bDeductGo').addEventListener('click', planDeduct);
    document.getElementById('bDeductResult').addEventListener('click', e => {
      if (e.target.closest('[data-apply-deduct]')) applyDeduct();
    });

    document.getElementById('bInvForm').addEventListener('submit', addInv);
    document.getElementById('bInventory').addEventListener('click', e => {
      const del = e.target.closest('[data-del-inv]');
      if (del) {
        S().inventory = S().inventory.filter(i => i.id !== del.dataset.delInv);
        Store.save();
        renderInventory();
      }
    });
    document.getElementById('bUseupGo').addEventListener('click', recommendUseup);

    document.getElementById('bEquipForm').addEventListener('submit', addEquip);
    document.getElementById('bEquipment').addEventListener('change', e => {
      const t = e.target.closest('[data-owned]');
      if (!t) return;
      const x = S().equipment.find(i => i.id === t.dataset.owned);
      if (x) { x.owned = t.checked; Store.save(); renderEquipment(); }
    });
    document.getElementById('bEquipment').addEventListener('click', e => {
      const del = e.target.closest('[data-del-equip]');
      if (del) {
        S().equipment = S().equipment.filter(x => x.id !== del.dataset.delEquip);
        Store.save();
        renderEquipment();
      }
    });
    document.getElementById('bNeedCalc').addEventListener('click', calcNeed);
  }

  window.Baking = {
    init() {
      bind();
      renderRecipeForm();
      renderRecipes();
      renderInventory();
      renderEquipment();
      renderUseupPick();
    },
    renderRecipes, renderInventory, renderUseupPick, daysTo, expiryChip,
    planDeduct, applyDeduct
  };
})();
