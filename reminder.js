(function () {
  'use strict';
  var L = window.CultivationLogic;
  var notifiedToday = false;
  var popupDismissed = false;

  function el(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function sync() {
    var now = new Date();
    var today = L.todayKey(now);
    var rec = window.App.getRecords()[today];
    var inWindow = L.isInWindow(now);
    updateCountdown(now, inWindow, rec);
    if (inWindow && !rec && !popupDismissed && !notifiedToday) {
      el('reminder-pop').classList.add('show');
      sendNotification();
      notifiedToday = true;
    }
  }

  function updateCountdown(now, inWindow, rec) {
    var box = el('countdown-box');
    if (rec) {
      box.textContent = rec.color === 'green' ? '今日已打卡 · 修为 +1 ✨' : '今日已打卡 · 破戒 😿';
      return;
    }
    if (inWindow) { box.textContent = '打卡窗口开启中！快去打卡~'; return; }
    var diff = L.getNextWindowTarget(now) - now.getTime();
    var s = Math.floor(diff / 1000);
    box.textContent = '距打卡 ' + pad(Math.floor(s / 3600)) + ':' + pad(Math.floor((s % 3600) / 60)) + ':' + pad(s % 60);
  }

  function dismissReminder() { popupDismissed = true; el('reminder-pop').classList.remove('show'); }
  function goCheckin() { dismissReminder(); window.App.openCheckin(window.App.getTodayKey()); }

  function sendNotification() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var body = '道友，23:00–23:30 记得打卡，今日修为 +1 等你拿~';
    if (navigator.serviceWorker) {
      navigator.serviceWorker.ready.then(function (reg) {
        reg.showNotification('⏰ 修仙打卡时间到！', {
          body: body, icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: 'cultivation-reminder'
        });
      }).catch(function () {});
    } else {
      try { new Notification('⏰ 修仙打卡时间到！', { body: body }); } catch (e) {}
    }
  }

  function requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }

  el('reminder-go').addEventListener('click', goCheckin);
  el('reminder-later').addEventListener('click', dismissReminder);
  el('reminder-close').addEventListener('click', dismissReminder);

  window.Reminder = { sync: sync, requestPermission: requestPermission };

  document.addEventListener('click', requestPermission, { once: true });
  setInterval(sync, 1000);
  sync();
})();
