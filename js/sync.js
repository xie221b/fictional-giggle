/* ============================================================
 * 手机与电脑联动：WebDAV 云同步 + 手动备份互传
 * ============================================================ */
(function () {
  const S = () => Store.state;

  function url() {
    const c = S().sync;
    if (!c.server) return '';
    const base = c.server.replace(/\/+$/, '');
    const file = (c.file || 'lifehub.json').replace(/^\/+/, '');
    return base + '/' + file;
  }

  function auth() {
    const c = S().sync;
    return 'Basic ' + btoa(encodeURIComponent(c.user) + ':' + encodeURIComponent(c.pass));
  }

  function status(msg) {
    document.getElementById('sStatus').textContent = msg;
  }

  async function request(method, body) {
    const u = url();
    if (!u) { status('请先填写 WebDAV 服务器地址。'); return null; }
    const opt = { method, headers: { Authorization: auth() } };
    if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = body;
    }
    const res = await fetch(u, opt);
    return res;
  }

  async function test() {
    try {
      const res = await request('GET');
      if (res && (res.ok || res.status === 404)) {
        status('连接成功 ✓' + (res.status === 404 ? '（云端还没有这个文件，点「上传到云端」即可创建）' : ''));
        Finance.toast('WebDAV 连接成功');
      } else {
        status('连接失败：HTTP ' + (res ? res.status : '无响应'));
        Finance.toast('连接失败，检查地址/账号/应用密码', true);
      }
    } catch (e) {
      status('连接失败：' + e.message);
      Finance.toast('连接失败：' + e.message, true);
    }
  }

  async function push() {
    try {
      const res = await request('PUT', Store.exportJson());
      if (res && res.ok) {
        S().sync.last = new Date().toLocaleString();
        Store.save();
        status('已上传到云端 ✓（' + S().sync.last + '）');
        Finance.toast('已上传到云端 ✓');
        return true;
      }
      status('上传失败：HTTP ' + (res ? res.status : '无响应'));
      return false;
    } catch (e) {
      status('上传失败：' + e.message);
      return false;
    }
  }

  async function pull() {
    try {
      const res = await request('GET');
      if (!res) return false;
      if (res.status === 404) { status('云端还没有文件，先「上传到云端」。'); return false; }
      if (!res.ok) { status('拉取失败：HTTP ' + res.status); return false; }
      const text = await res.text();
      Store.importJson(text);
      S().sync.last = new Date().toLocaleString();
      Store.save();
      status('已从云端拉取 ✓（' + S().sync.last + '）');
      Finance.toast('已从云端拉取 ✓');
      if (window.App) App.switchView('dashboard');
      return true;
    } catch (e) {
      status('拉取失败：' + e.message);
      return false;
    }
  }

  function saveConfig() {
    const c = S().sync;
    c.server = document.getElementById('sServer').value.trim();
    c.user = document.getElementById('sUser').value.trim();
    c.pass = document.getElementById('sPass').value.trim();
    c.file = document.getElementById('sFile').value.trim() || 'lifehub.json';
    c.enabled = document.getElementById('sAuto').checked;
    Store.save();
  }

  function render() {
    const c = S().sync;
    document.getElementById('sServer').value = c.server;
    document.getElementById('sUser').value = c.user;
    document.getElementById('sPass').value = c.pass;
    document.getElementById('sFile').value = c.file;
    document.getElementById('sAuto').checked = c.enabled;
    document.getElementById('sStatus').textContent = c.last ? '上次同步：' + c.last : '尚未配置同步。';
  }

  let pushTimer = null;
  function maybeAutoSync() {
    if (!S().sync.enabled || !S().sync.server) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push(), 5000);
  }

  function bind() {
    document.getElementById('sTest').addEventListener('click', () => { saveConfig(); test(); });
    document.getElementById('sPush').addEventListener('click', () => { saveConfig(); push(); });
    document.getElementById('sPull').addEventListener('click', () => { saveConfig(); pull(); });
    document.getElementById('sAuto').addEventListener('change', saveConfig);
    ['sServer', 'sUser', 'sPass', 'sFile'].forEach(id => {
      document.getElementById(id).addEventListener('change', saveConfig);
    });
  }

  window.Sync = {
    init() { bind(); render(); },
    maybeAutoSync, push, pull, test
  };

  // 钩住 Store.save：开启自动同步时，保存后 5 秒自动上传
  const origSave = window.Store.save;
  window.Store.save = function () {
    origSave.call(Store);
    if (window.Sync) window.Sync.maybeAutoSync();
  };
})();
