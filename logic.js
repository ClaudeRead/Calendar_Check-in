(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.CultivationLogic = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var WINDOW_START = { hour: 23, minute: 0 };
  var WINDOW_END = { hour: 23, minute: 30 };

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function toDateKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayKey(now) { return toDateKey(now || new Date()); }

  function getCheckinState(dateKey, now) {
    var today = todayKey(now);
    if (dateKey === today) return 'today';
    return dateKey < today ? 'past' : 'future';
  }

  function isInWindow(now) {
    var t = now.getHours() * 60 + now.getMinutes();
    return t >= (WINDOW_START.hour * 60 + WINDOW_START.minute)
        && t < (WINDOW_END.hour * 60 + WINDOW_END.minute);
  }

  function getNextWindowTarget(now) {
    var target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), WINDOW_START.hour, WINDOW_START.minute, 0, 0);
    if (target <= now) {
      target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, WINDOW_START.hour, WINDOW_START.minute, 0, 0);
    }
    return target.getTime();
  }

  function computeStats(records, now) {
    var today = todayKey(now);
    var totalGreen = 0, totalRed = 0;
    Object.keys(records).forEach(function (k) {
      var r = records[k];
      if (r && r.color === 'green') totalGreen++;
      else if (r && r.color === 'red') totalRed++;
    });

    var todayRecord = records[today];
    if (todayRecord && todayRecord.color === 'red') {
      return { totalGreen: totalGreen, totalRed: totalRed, streak: 0 };
    }
    var cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    if (!(todayRecord && todayRecord.color === 'green')) {
      cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    }
    var streak = 0;
    while (true) {
      var rec = records[toDateKey(cursor)];
      if (rec && rec.color === 'green') {
        streak++;
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1, 0, 0, 0, 0);
      } else { break; }
    }
    return { totalGreen: totalGreen, totalRed: totalRed, streak: streak };
  }

  return {
    WINDOW_START: WINDOW_START,
    WINDOW_END: WINDOW_END,
    pad2: pad2,
    toDateKey: toDateKey,
    todayKey: todayKey,
    getCheckinState: getCheckinState,
    isInWindow: isInWindow,
    getNextWindowTarget: getNextWindowTarget,
    computeStats: computeStats
  };
});
