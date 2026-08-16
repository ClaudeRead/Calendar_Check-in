(function () {
  'use strict';
  var L = window.CultivationLogic;
  var LEGACY_KEY = 'cultivation-records-v1';

  var state = {
    records: {},
    settings: { background_url: '', icon_url: '' },
    viewYear: null,
    viewMonth: null,
    selectedDate: null,
    selectedColor: null,
    greenLocked: false,
    user: null
  };

  var sb = null;

  function el(id) { return document.getElementById(id); }
  function parseKey(key) { var p = key.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

  function initSupabase() {
    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase) {
      sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    }
  }

  // ---------- 视图切换 ----------
  function showAuth() { el('auth-view').classList.add('show'); el('app-view').classList.add('hidden'); }
  function showApp() { el('auth-view').classList.remove('show'); el('app-view').classList.remove('hidden'); }

  // ---------- 认证 ----------
  async function signIn() {
    var email = el('auth-email').value.trim();
    var pw = el('auth-password').value;
    if (!email || !pw) { toast('请输入邮箱和密码'); return; }
    setAuthBusy(true);
    var r = await sb.auth.signInWithPassword({ email: email, password: pw });
    setAuthBusy(false);
    if (r.error) { toast('登录失败：' + (r.error.message || '邮箱或密码错误')); }
  }

  async function signUp() {
    var email = el('auth-email').value.trim();
    var pw = el('auth-password').value;
    if (!email || !pw) { toast('请输入邮箱和密码'); return; }
    if (pw.length < 8) { toast('密码至少 8 位'); return; }
    setAuthBusy(true);
    var r = await sb.auth.signUp({ email: email, password: pw });
    setAuthBusy(false);
    if (r.error) { toast('注册失败：' + (r.error.message || '')); return; }
    if (r.data && r.data.session) { toast('注册成功，正在同步…'); }
    else { toast('注册成功！请查收邮箱确认邮件后，再点「登录」'); }
  }

  function setAuthBusy(busy) {
    el('auth-signin-btn').disabled = busy;
    el('auth-signup-btn').disabled = busy;
  }

  async function signOut() {
    await sb.auth.signOut();
  }

  // ---------- 数据（Supabase） ----------
  async function loadRecords() {
    if (!sb || !state.user) return;
    var r = await sb.from('records').select('date_key,color,note,is_makeup');
    if (r.error) { console.warn(r.error); return; }
    var map = {};
    (r.data || []).forEach(function (row) { map[row.date_key] = { color: row.color, note: row.note, is_makeup: !!row.is_makeup }; });
    state.records = map;
  }

  async function loadSettings() {
    if (!sb || !state.user) return;
    var r = await sb.from('settings').select('background_url,icon_url').eq('user_id', state.user.id).maybeSingle();
    if (r.error) { console.warn(r.error); return; }
    if (r.data) {
      state.settings.background_url = r.data.background_url || '';
      state.settings.icon_url = r.data.icon_url || '';
    }
    applyBackground();
    applyIcon();
  }

  async function saveSettings() {
    if (!sb || !state.user) return;
    var r = await sb.from('settings').upsert({
      user_id: state.user.id,
      background_url: state.settings.background_url,
      icon_url: state.settings.icon_url,
      updated_at: new Date().toISOString()
    });
    if (r.error) { toast('设置保存失败：' + (r.error.message || '')); return; }
    applyBackground();
    applyIcon();
    toast('设置已保存 ✨');
  }

  async function upsertRecord(dateKey, color, note, isMakeup) {
    if (!sb || !state.user) return { error: { message: '未登录' } };
    return await sb.from('records').upsert({
      user_id: state.user.id,
      date_key: dateKey,
      color: color,
      note: note,
      is_makeup: !!isMakeup
    }, { onConflict: 'user_id,date_key' });
  }

  async function deleteRecord(dateKey) {
    if (!sb || !state.user) return { error: { message: '未登录' } };
    return await sb.from('records').delete().eq('user_id', state.user.id).eq('date_key', dateKey);
  }

  // 一次性迁移：把 v1 的本地记录导入云端
  async function maybeMigrate() {
    var legacy = null;
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null'); } catch (e) {}
    if (!legacy || !Object.keys(legacy).length) return;
    if (Object.keys(state.records).length > 0) return;
    var rows = Object.keys(legacy).map(function (k) {
      return { user_id: state.user.id, date_key: k, color: legacy[k].color, note: legacy[k].note || '', is_makeup: false };
    });
    var r = await sb.from('records').upsert(rows, { onConflict: 'user_id,date_key' });
    if (!r.error) {
      localStorage.removeItem(LEGACY_KEY);
      await loadRecords();
      toast('已导入旧版本的本地记录');
    }
  }

  // ---------- 自定义外观 ----------
  // 只允许 http/https，防止 javascript: 等协议注入
  function isSafeUrl(u) {
    return /^https?:\/\//i.test(u);
  }

  function applyBackground() {
    var url = state.settings.background_url;
    if (url && isSafeUrl(url)) {
      document.body.style.backgroundImage = 'url("' + url + '"), linear-gradient(180deg, #FFF9F0, #FBF6EC)';
      document.body.style.backgroundSize = 'cover, auto';
      document.body.style.backgroundPosition = 'center, center';
      document.body.style.backgroundAttachment = 'fixed, fixed';
    } else {
      document.body.style.backgroundImage = '';
      document.body.style.backgroundSize = '';
      document.body.style.backgroundPosition = '';
      document.body.style.backgroundAttachment = '';
    }
  }

  function applyIcon() {
    var url = state.settings.icon_url;
    var link = document.querySelector('link[rel="icon"]');
    if (link && url && isSafeUrl(url)) link.href = url;
  }

  // ---------- 统计 ----------
  function updateStats() {
    var s = L.computeStats(state.records, new Date());
    el('stat-cultivation').textContent = s.displayCultivation;
    el('stat-streak').textContent = s.streak;
    el('stat-break').textContent = s.totalRed;
    el('stat-longest').textContent = s.longestStreak;
  }

  // ---------- 日历 ----------
  function renderCalendar() {
    var y = state.viewYear, m = state.viewMonth;
    el('cal-title').textContent = y + ' 年 ' + (m + 1) + ' 月';
    var grid = el('cal-grid');
    grid.innerHTML = '';
    var startDow = (new Date(y, m, 1).getDay() + 6) % 7; // 周一=0
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var today = L.todayKey(new Date());
    for (var i = 0; i < startDow; i++) grid.appendChild(blankCell());
    for (var d = 1; d <= daysInMonth; d++) {
      grid.appendChild(dayCell(y + '-' + L.pad2(m + 1) + '-' + L.pad2(d), d, today));
    }
  }

  function blankCell() { var div = document.createElement('div'); div.className = 'day-cell blank'; return div; }

  function dayCell(key, dayNum, today) {
    var div = document.createElement('button');
    div.type = 'button';
    div.className = 'day-cell';
    var st = L.getCheckinState(key, new Date());
    var rec = state.records[key];
    var num = document.createElement('span'); num.className = 'day-num'; num.textContent = dayNum;
    div.appendChild(num);
    if (rec) {
      div.classList.add(rec.color === 'green' ? 'bg-green' : 'bg-red');
      if (rec.is_makeup) {
        var badge = document.createElement('span');
        badge.className = 'day-badge';
        badge.textContent = '补';
        div.appendChild(badge);
      }
    }
    if (key === today) div.classList.add('today');
    if (st === 'future') div.classList.add('future');
    div.addEventListener('click', function () { onDayClick(key, st); });
    return div;
  }

  function onDayClick(key, st) {
    if (st === 'future') { toast('未来日期不可打卡哦~'); return; }
    openCheckin(key);
  }

  // ---------- 打卡弹窗 ----------
  function openCheckin(dateKey) {
    state.selectedDate = dateKey;
    state.greenLocked = false;
    var rec = state.records[dateKey] || null;
    var d = parseKey(dateKey);
    var st = L.getCheckinState(dateKey, new Date());
    var title = (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
    if (st === 'today') title += ' · 今日打卡';
    else if (st === 'past') title += ' · 补卡';
    el('modal-title').textContent = title;
    el('note-input').value = rec ? (rec.note || '') : '';
    state.selectedColor = rec ? rec.color : null;
    el('window-hint').textContent = windowHint(st);
    el('delete-btn').style.display = (rec && !rec.is_makeup) ? 'inline-flex' : 'none';
    updateColorButtons();
    el('modal-backdrop').classList.add('open');
  }

  function canCheck(dateKey) {
    var st = L.getCheckinState(dateKey, new Date());
    return st === 'past' || (st === 'today' && L.isInWindow(new Date()));
  }

  function updateColorButtons() {
    var ok = state.selectedDate ? canCheck(state.selectedDate) : false;
    el('color-green').disabled = !ok || state.greenLocked;
    el('color-red').disabled = !ok;
    el('color-green').classList.toggle('selected', state.selectedColor === 'green');
    el('color-red').classList.toggle('selected', state.selectedColor === 'red');
    el('save-btn').disabled = !ok;
  }

  function windowHint(st) {
    var now = new Date();
    if (st === 'past') return '补卡不受时间限制（补卡计入连续天数，日期标记「补」）';
    if (L.isInWindow(now)) return '窗口开启中！选择颜色后保存吧~';
    var diff = L.getNextWindowTarget(now) - now.getTime();
    var mins = Math.floor(diff / 60000);
    var h = Math.floor(mins / 60), mm = mins % 60;
    if (h > 0) return '今日打卡窗口 23:00–23:30，还有 ' + h + ' 小时 ' + mm + ' 分钟';
    return '今日打卡窗口 23:00–23:30，还有 ' + mm + ' 分钟';
  }

  function closeCheckin() { el('modal-backdrop').classList.remove('open'); }

  // 绿色打卡二次确认
  function onGreenClick() {
    if (state.greenLocked) return;
    el('confirm-modal').classList.add('open');
  }
  function confirmYes() {
    state.selectedColor = 'green';
    state.greenLocked = false;
    el('confirm-modal').classList.remove('open');
    updateColorButtons();
  }
  function confirmNo() {
    state.selectedColor = 'red';
    state.greenLocked = true;
    el('confirm-modal').classList.remove('open');
    updateColorButtons();
    toast('请注意自己的修为，今日修为 −10！！！');
  }

  async function saveCheckin() {
    var dateKey = state.selectedDate;
    if (!dateKey) return;
    if (!state.selectedColor) { toast('请先选择颜色'); return; }
    var st = L.getCheckinState(dateKey, new Date());
    if (st === 'today' && !L.isInWindow(new Date())) {
      toast('今日打卡仅在 23:00–23:30 开放哦~'); return;
    }
    var color = state.selectedColor;
    var note = el('note-input').value.trim();
    var isMakeup = st === 'past';
    el('save-btn').disabled = true;
    var r = await upsertRecord(dateKey, color, note, isMakeup);
    el('save-btn').disabled = false;
    if (r.error) { toast('保存失败：' + (r.error.message || '')); return; }
    state.records[dateKey] = { color: color, note: note, is_makeup: isMakeup };
    closeCheckin();
    refresh();
    if (isMakeup) {
      toast(color === 'green' ? '补卡成功：修为 +5，连续天数已延续' : '补记破戒：修为 −10');
    } else {
      toast(color === 'green' ? '今日修为 +5 ✨' : '破戒，修为 −10');
    }
    maybeShowQuote(L.computeStats(state.records, new Date()).displayCultivation);
  }

  async function deleteCheckin() {
    if (!state.selectedDate) return;
    var dateKey = state.selectedDate;
    var r = await deleteRecord(dateKey);
    if (r.error) { toast('删除失败：' + (r.error.message || '')); return; }
    delete state.records[dateKey];
    closeCheckin();
    refresh();
    toast('已删除该日记录');
  }

  // ---------- 修为名言弹窗 ----------
  function maybeShowQuote(cultivation) {
    var q = L.getCultivationQuote(cultivation);
    if (!q) return;
    el('quote-text').textContent = q;
    el('quote-level').textContent = '当前修为 · ' + cultivation;
    el('quote-modal').classList.add('open');
  }
  function closeQuote() { el('quote-modal').classList.remove('open'); }

  function showNotice(msg) { el('notice-text').textContent = msg; el('notice-modal').classList.add('open'); }
  function closeNotice() { el('notice-modal').classList.remove('open'); }

  // ---------- 设置 ----------
  function openSettings() {
    el('bg-input').value = state.settings.background_url;
    el('icon-input').value = state.settings.icon_url;
    el('settings-modal').classList.add('open');
  }
  function closeSettings() { el('settings-modal').classList.remove('open'); }
  async function saveSettingsClick() {
    var bg = el('bg-input').value.trim();
    var icon = el('icon-input').value.trim();
    if (bg && !isSafeUrl(bg)) { toast('背景图 URL 需以 http:// 或 https:// 开头'); return; }
    if (icon && !isSafeUrl(icon)) { toast('图标 URL 需以 http:// 或 https:// 开头'); return; }
    state.settings.background_url = bg;
    state.settings.icon_url = icon;
    await saveSettings();
    closeSettings();
  }

  // ---------- 通用 ----------
  function refresh() {
    renderCalendar();
    updateStats();
    if (window.Reminder) window.Reminder.sync();
  }

  function toast(msg) {
    var t = el('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  // ---------- 登录后 ----------
  async function onLoggedIn() {
    showApp();
    await loadRecords();
    await loadSettings();
    await maybeMigrate();
    el('user-email').textContent = state.user.email || '';
    refresh();
  }

  // ---------- 事件绑定 ----------
  function bindEvents() {
    el('auth-signin-btn').addEventListener('click', signIn);
    el('auth-signup-btn').addEventListener('click', signUp);
    el('auth-password').addEventListener('keydown', function (e) { if (e.key === 'Enter') signIn(); });

    el('prev-btn').addEventListener('click', function () {
      state.viewMonth--; if (state.viewMonth < 0) { state.viewMonth = 11; state.viewYear--; } refresh();
    });
    el('next-btn').addEventListener('click', function () {
      state.viewMonth++; if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear++; } refresh();
    });
    el('today-btn').addEventListener('click', function () {
      var n = new Date(); state.viewYear = n.getFullYear(); state.viewMonth = n.getMonth(); refresh();
    });

    el('modal-close').addEventListener('click', closeCheckin);
    el('modal-backdrop').addEventListener('click', function (e) { if (e.target === this) closeCheckin(); });
    el('save-btn').addEventListener('click', saveCheckin);
    el('delete-btn').addEventListener('click', deleteCheckin);
    el('color-green').addEventListener('click', onGreenClick);
    el('color-red').addEventListener('click', function () { state.selectedColor = 'red'; updateColorButtons(); });

    el('confirm-yes').addEventListener('click', confirmYes);
    el('confirm-no').addEventListener('click', confirmNo);
    el('confirm-cancel').addEventListener('click', function () { el('confirm-modal').classList.remove('open'); });

    el('quote-close').addEventListener('click', closeQuote);
    el('quote-modal').addEventListener('click', function (e) { if (e.target === this) closeQuote(); });
    el('notice-ok').addEventListener('click', closeNotice);
    el('notice-modal').addEventListener('click', function (e) { if (e.target === this) closeNotice(); });

    el('settings-btn').addEventListener('click', openSettings);
    el('settings-close').addEventListener('click', closeSettings);
    el('settings-modal').addEventListener('click', function (e) { if (e.target === this) closeSettings(); });
    el('settings-save').addEventListener('click', saveSettingsClick);
    el('settings-signout').addEventListener('click', signOut);
  }

  // ---------- 初始化 ----------
  async function init() {
    initSupabase();
    if (!sb) { el('auth-view').classList.add('show'); el('app-view').classList.add('hidden'); return; }
    bindEvents();

    var now = new Date();
    state.viewYear = now.getFullYear();
    state.viewMonth = now.getMonth();

    var r = await sb.auth.getSession();
    if (r.data && r.data.session) {
      state.user = r.data.session.user;
      await onLoggedIn();
    } else {
      showAuth();
    }

    sb.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_IN' && session) {
        state.user = session.user;
        onLoggedIn();
      } else if (event === 'SIGNED_OUT') {
        state.user = null;
        state.records = {};
        showAuth();
      }
    });
  }

  window.App = {
    openCheckin: openCheckin,
    refresh: refresh,
    toast: toast,
    getRecords: function () { return state.records; },
    getTodayKey: function () { return L.todayKey(new Date()); },
    isLoggedIn: function () { return !!state.user; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
