(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.CultivationLogic = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var WINDOW_START = { hour: 23, minute: 0 };
  var WINDOW_END = { hour: 23, minute: 30 };

  // 修为名言映射（9 的倍数，1~9 依次对应 9~81）
  var QUOTES = [
    '善恶一时妄念，荣枯都不关心',       // 9
    '无念方能静，静中气自平',           // 18
    '神驭气，气留形，不须杂术自长生',   // 27
    '损之又损慎前功',                   // 36
    '死生宠辱不须惊',                   // 45
    '四方上下同一空，千古万古无初终',   // 54
    '万物芸芸各返根，返根复命即长存',   // 63
    '为仙为佛与为儒，三教单传一个虚',   // 72
    '此身早化飘萍去，独向鸿蒙顶上看'    // 81
  ];

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
    var greenOnTime = 0, greenMakeup = 0, redTotal = 0;
    Object.keys(records).forEach(function (k) {
      var r = records[k];
      if (r && r.color === 'green') {
        if (r.is_makeup) greenMakeup++;
        else greenOnTime++;
      } else if (r && r.color === 'red') {
        redTotal++;
      }
    });

    var todayRecord = records[today];
    var streak;
    if (todayRecord && todayRecord.color === 'red') {
      streak = 0;
    } else {
      var cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      if (!(todayRecord && todayRecord.color === 'green')) {
        cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      }
      streak = 0;
      while (true) {
        var rec = records[toDateKey(cursor)];
        if (rec && rec.color === 'green') {
          streak++;
          cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1, 0, 0, 0, 0);
        } else { break; }
      }
    }

    var cultivation = 5 * greenOnTime - 5 * greenMakeup - 10 * redTotal;
    return {
      totalGreen: greenOnTime + greenMakeup,
      totalRed: redTotal,
      greenOnTime: greenOnTime,
      greenMakeup: greenMakeup,
      makeupCount: greenMakeup,
      streak: streak,
      cultivation: cultivation,
      displayCultivation: Math.max(0, cultivation)
    };
  }

  // 修为值为正的 9 的倍数时返回对应名言，否则返回 null
  function getCultivationQuote(cultivation) {
    if (!cultivation || cultivation <= 0 || cultivation % 9 !== 0) return null;
    var k = cultivation / 9;
    var index = (k - 1) % QUOTES.length;
    return QUOTES[index];
  }

  return {
    WINDOW_START: WINDOW_START,
    WINDOW_END: WINDOW_END,
    QUOTES: QUOTES,
    pad2: pad2,
    toDateKey: toDateKey,
    todayKey: todayKey,
    getCheckinState: getCheckinState,
    isInWindow: isInWindow,
    getNextWindowTarget: getNextWindowTarget,
    computeStats: computeStats,
    getCultivationQuote: getCultivationQuote
  };
});
