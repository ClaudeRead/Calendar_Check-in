(function () {
  'use strict';
  var L = window.CultivationLogic;
  var STORAGE_KEY = 'cultivation-records-v1';

  var state = {
    records: loadRecords(),
    viewYear: null,
    viewMonth: null,
    selectedDate: null,
    selectedColor: null
  };

  function loadRecords() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveRecords() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records)); }
    catch (e) { toast('保存失败：浏览器存储空间不足'); }
  }
  function el(id) { return document.getElementById(id); }
  function parseKey(key) { var p = key.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

  function updateStats() {
    var s = L.computeStats(state.records, new Date());
    el('stat-cultivation').textContent = s.totalGreen;
    el('stat-streak').textContent = s.streak;
    el('stat-break').textContent = s.totalRed;
  }

  function renderCalendar() {
    var y = state.viewYear, m = state.viewMonth;
    el('cal-title').textContent = y + ' 年 ' + (m + 1) + ' 月';
    var grid = el('cal-grid');
    grid.innerHTML = '';
    var first = new Date(y, m, 1);
    var startDow = (first.getDay() + 6) % 7; // 周一=0
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var today = L.todayKey(new Date());
    for (var i = 0; i < startDow; i++) grid.appendChild(blankCell());
    for (var d = 1; d <= daysInMonth; d++) {
      var key = y + '-' + L.pad2(m + 1) + '-' + L.pad2(d);
      grid.appendChild(dayCell(key, d, today));
    }
  }

  function blankCell() { var div = document.createElement('div'); div.className = 'day-cell blank'; return div; }

  function dayCell(key, dayNum, today) {
    var div = document.createElement('button');
    div.type = 'button';
    div.className = 'day-cell';
    var st = L.getCheckinState(key, new Date());
    var rec = state.records[key];
    var num = document.createElement('span');
    num.className = 'day-num';
    num.textContent = dayNum;
    var dot = document.createElement('span');
    dot.className = 'day-dot';
    if (rec) dot.classList.add('dot-' + rec.color);
    div.appendChild(num); div.appendChild(dot);
    if (key === today) div.classList.add('today');
    if (st === 'future') div.classList.add('future');
    div.addEventListener('click', function () { onDayClick(key, st); });
    return div;
  }

  function onDayClick(key, st) {
    if (st === 'future') { toast('未来日期不可打卡哦~'); return; }
    openCheckin(key);
  }

  function openCheckin(dateKey) {
    state.selectedDate = dateKey;
    state.selectedColor = null;
    var rec = state.records[dateKey] || null;
    var d = parseKey(dateKey);
    var st = L.getCheckinState(dateKey, new Date());
    var title = (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
    if (st === 'today') title += ' · 今日打卡';
    else if (st === 'past') title += ' · 补卡';
    el('modal-title').textContent = title;
    el('note-input').value = rec ? (rec.note || '') : '';
    setColorButtons(rec ? rec.color : null);
    var canCheck = st === 'past' || (st === 'today' && L.isInWindow(new Date()));
    el('save-btn').disabled = !canCheck;
    el('color-green').disabled = !canCheck;
    el('color-red').disabled = !canCheck;
    el('window-hint').textContent = windowHint(st);
    el('delete-btn').style.display = rec ? 'inline-flex' : 'none';
    el('modal-backdrop').classList.add('open');
  }

  function setColorButtons(active) {
    state.selectedColor = active;
    ['green', 'red'].forEach(function (c) {
      el('color-' + c).classList.toggle('selected', c === active);
    });
  }

  function windowHint(st) {
    var now = new Date();
    if (st === 'past') return '补卡不受时间限制，随时都可以哦~';
    if (L.isInWindow(now)) return '窗口开启中！选择颜色后保存吧~';
    var diff = L.getNextWindowTarget(now) - now.getTime();
    var mins = Math.floor(diff / 60000);
    var h = Math.floor(mins / 60), mm = mins % 60;
    if (h > 0) return '今日打卡窗口 23:00–23:30，还有 ' + h + ' 小时 ' + mm + ' 分钟';
    return '今日打卡窗口 23:00–23:30，还有 ' + mm + ' 分钟';
  }

  function closeCheckin() { el('modal-backdrop').classList.remove('open'); }

  function saveCheckin() {
    var dateKey = state.selectedDate;
    if (!dateKey) return;
    if (!state.selectedColor) { toast('请先选择颜色：修为 +1 或 破戒'); return; }
    if (L.getCheckinState(dateKey, new Date()) === 'today' && !L.isInWindow(new Date())) {
      toast('今日打卡仅在 23:00–23:30 开放哦~'); return;
    }
    state.records[dateKey] = { color: state.selectedColor, note: el('note-input').value.trim() };
    saveRecords();
    closeCheckin();
    refresh();
    toast(state.selectedColor === 'green' ? '修为 +1！继续保持~' : '记下破戒，明日再战！');
  }

  function deleteCheckin() {
    if (!state.selectedDate) return;
    delete state.records[state.selectedDate];
    saveRecords();
    closeCheckin();
    refresh();
    toast('已删除该日记录');
  }

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
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function init() {
    var now = new Date();
    state.viewYear = now.getFullYear();
    state.viewMonth = now.getMonth();
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
    el('color-green').addEventListener('click', function () { setColorButtons('green'); });
    el('color-red').addEventListener('click', function () { setColorButtons('red'); });
    refresh();
  }

  window.App = {
    openCheckin: openCheckin,
    refresh: refresh,
    toast: toast,
    getRecords: function () { return state.records; },
    getTodayKey: function () { return L.todayKey(new Date()); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
