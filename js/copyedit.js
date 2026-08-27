/* ============================================================
 * 文案编辑：所有提示文字在此集中编辑，保存后实时生效
 * ============================================================ */
(function () {
  const S = () => Store.state;

  function render() {
    const c = S().copy;
    document.getElementById('cQuestions').value = c.questions || '';
    document.getElementById('cFillers').value = c.fillers || '';
    document.getElementById('cSkeleton').value = c.skeleton || '';
    document.getElementById('cMedia').value = c.media || '';
    document.getElementById('cSpeech').value = c.speech || '';
    document.getElementById('cIntercept').value = (c.interceptTitle || '') + '\n' + (c.interceptBody || '');
    document.getElementById('cUseup').value = c.useupTips || '';
    document.getElementById('cShoot').value = c.shoot || '';
    document.getElementById('cUi').value = Object.entries(c.ui || {}).map(([k, v]) => `${k}：${v}`).join('\n');
  }

  function save() {
    const c = S().copy;
    c.questions = document.getElementById('cQuestions').value;
    c.fillers = document.getElementById('cFillers').value;
    c.skeleton = document.getElementById('cSkeleton').value;
    c.media = document.getElementById('cMedia').value;
    c.speech = document.getElementById('cSpeech').value;
    const intercept = document.getElementById('cIntercept').value.split('\n');
    c.interceptTitle = (intercept[0] || '').trim() || '⚠️ 拦截提醒：先清库存';
    c.interceptBody = intercept.slice(1).join('\n').trim();
    c.useupTips = document.getElementById('cUseup').value;
    c.shoot = document.getElementById('cShoot').value;
    c.ui = {};
    document.getElementById('cUi').value.split('\n').forEach(raw => {
      const l = raw.trim();
      if (!l) return;
      const i = l.indexOf('：');
      if (i < 0) return;
      c.ui[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    });
    Store.save();
    refreshViews();
    Finance.toast('文字已保存并生效 ✓');
  }

  function reset() {
    if (!window.confirm('确定恢复默认文字？你改过的内容会被覆盖。')) return;
    S().copy = JSON.parse(JSON.stringify(Store.defaultCopy));
    Store.save();
    render();
    refreshViews();
    Finance.toast('已恢复默认文字');
  }

  function refreshViews() {
    if (window.Thinking) Thinking.refresh();
    if (window.Media) { Media.renderShoot(); Media.renderSchedule(); }
    if (window.Finance) Finance.renderFinance();
    if (window.App) App.renderDashboard();
    App.applyTexts();
    App.applyEditState();
  }

  function bind() {
    document.getElementById('cSave').addEventListener('click', save);
    document.getElementById('cReset').addEventListener('click', reset);
  }

  window.CopyEdit = { init() { bind(); render(); }, render, save, reset };
})();
