const test = require('node:test');
const assert = require('node:assert');
const L = require('../logic.js');

test('pad2 补零', () => {
  assert.strictEqual(L.pad2(5), '05');
  assert.strictEqual(L.pad2(12), '12');
});

test('toDateKey 生成本地日期键', () => {
  assert.strictEqual(L.toDateKey(new Date(2026, 7, 16, 12, 0, 0)), '2026-08-16');
  assert.strictEqual(L.toDateKey(new Date(2026, 0, 1, 0, 0, 0)), '2026-01-01');
});

test('getCheckinState 分类过去/今天/未来', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  assert.strictEqual(L.getCheckinState('2026-08-16', now), 'today');
  assert.strictEqual(L.getCheckinState('2026-08-15', now), 'past');
  assert.strictEqual(L.getCheckinState('2026-08-17', now), 'future');
});

test('isInWindow 半开区间 [23:00, 23:30)', () => {
  assert.strictEqual(L.isInWindow(new Date(2026, 7, 16, 22, 59, 59)), false);
  assert.strictEqual(L.isInWindow(new Date(2026, 7, 16, 23, 0, 0)), true);
  assert.strictEqual(L.isInWindow(new Date(2026, 7, 16, 23, 15, 0)), true);
  assert.strictEqual(L.isInWindow(new Date(2026, 7, 16, 23, 30, 0)), false);
});

test('getNextWindowTarget 窗口前 = 今日 23:00', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  assert.strictEqual(L.getNextWindowTarget(now), new Date(2026, 7, 16, 23, 0, 0).getTime());
});

test('getNextWindowTarget 窗口后 = 明日 23:00', () => {
  const now = new Date(2026, 7, 16, 23, 45, 0);
  assert.strictEqual(L.getNextWindowTarget(now), new Date(2026, 7, 17, 23, 0, 0).getTime());
});

test('computeStats 统计修为/破戒/连续天数（今日绿）', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  const records = {
    '2026-08-16': { color: 'green', note: '' },
    '2026-08-15': { color: 'green', note: '' },
    '2026-08-14': { color: 'red', note: '' },
    '2026-08-13': { color: 'green', note: '' }
  };
  const s = L.computeStats(records, now);
  assert.strictEqual(s.totalGreen, 3);
  assert.strictEqual(s.totalRed, 1);
  assert.strictEqual(s.streak, 2);
  assert.strictEqual(s.cultivation, 5); // 3*5 - 1*10
  assert.strictEqual(s.longestStreak, 2);
});

test('computeStats 今日未打卡从昨天起算', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  const records = {
    '2026-08-15': { color: 'green', note: '' },
    '2026-08-14': { color: 'green', note: '' },
    '2026-08-13': { color: 'green', note: '' }
  };
  const s = L.computeStats(records, now);
  assert.strictEqual(s.streak, 3);
  assert.strictEqual(s.cultivation, 15);
  assert.strictEqual(s.longestStreak, 3);
});

test('computeStats 今日破戒连续天数为 0', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  const records = {
    '2026-08-16': { color: 'red', note: '' },
    '2026-08-15': { color: 'green', note: '' }
  };
  const s = L.computeStats(records, now);
  assert.strictEqual(s.streak, 0);
  assert.strictEqual(s.cultivation, -5); // 5 - 10
  assert.strictEqual(s.displayCultivation, 0);
  assert.strictEqual(s.longestStreak, 1);
});

test('computeStats 修为值不显示负数', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  const records = {
    '2026-08-16': { color: 'red', note: '' },
    '2026-08-15': { color: 'red', note: '' },
    '2026-08-14': { color: 'green', note: '' }
  };
  const s = L.computeStats(records, now);
  assert.strictEqual(s.cultivation, -15);
  assert.strictEqual(s.displayCultivation, 0);
});

test('computeStats 当日绿色 +5', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  const records = { '2026-08-16': { color: 'green', note: '', is_makeup: false } };
  const s = L.computeStats(records, now);
  assert.strictEqual(s.greenOnTime, 1);
  assert.strictEqual(s.cultivation, 5);
  assert.strictEqual(s.longestStreak, 1);
});

test('computeStats 绿色补卡不影响修为值', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  const records = { '2026-08-15': { color: 'green', note: '', is_makeup: true } };
  const s = L.computeStats(records, now);
  assert.strictEqual(s.greenMakeup, 1);
  assert.strictEqual(s.cultivation, 0);
  assert.strictEqual(s.streak, 1); // 补卡绿计入连续天数
  assert.strictEqual(s.longestStreak, 1);
});

test('computeStats 红色补卡不影响修为值且中断连续天数', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  const records = { '2026-08-15': { color: 'red', note: '', is_makeup: true } };
  const s = L.computeStats(records, now);
  assert.strictEqual(s.cultivation, 0);
  assert.strictEqual(s.streak, 0);
  assert.strictEqual(s.longestStreak, 0);
});

test('computeStats 当日红色破戒扣 10', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  const records = { '2026-08-16': { color: 'red', note: '', is_makeup: false } };
  const s = L.computeStats(records, now);
  assert.strictEqual(s.totalRed, 1);
  assert.strictEqual(s.cultivation, -10);
  assert.strictEqual(s.streak, 0);
});

test('computeStats 补卡延续连续天数（填补断档）', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  const records = {
    '2026-08-16': { color: 'green', note: '', is_makeup: false },
    '2026-08-15': { color: 'green', note: '', is_makeup: true },
    '2026-08-14': { color: 'green', note: '', is_makeup: false }
  };
  const s = L.computeStats(records, now);
  assert.strictEqual(s.streak, 3);
  assert.strictEqual(s.cultivation, 10); // 当日绿 16、14 各 +5，补卡绿 15 不生效
  assert.strictEqual(s.longestStreak, 3);
});

test('computeStats 补卡未修复中间断档则不计入当前', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  const records = {
    '2026-08-16': { color: 'green', note: '', is_makeup: false },
    '2026-08-14': { color: 'green', note: '', is_makeup: true },
    '2026-08-13': { color: 'green', note: '', is_makeup: false }
  };
  const s = L.computeStats(records, now);
  assert.strictEqual(s.streak, 1);
  assert.strictEqual(s.longestStreak, 2); // 14、13 连成 2 天
});

test('computeStats 最长修炼天数（历史最长）', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  const records = {
    '2026-08-16': { color: 'green', note: '' },
    '2026-08-15': { color: 'green', note: '' },
    '2026-08-14': { color: 'red', note: '' },
    '2026-08-13': { color: 'green', note: '' },
    '2026-08-12': { color: 'green', note: '' },
    '2026-08-11': { color: 'green', note: '' },
    '2026-08-10': { color: 'green', note: '' }
  };
  const s = L.computeStats(records, now);
  assert.strictEqual(s.streak, 2); // 16、15（14 红中断）
  assert.strictEqual(s.longestStreak, 4); // 13、12、11、10
});

test('computeStats 破戒补签也中断连续天数', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  const records = {
    '2026-08-16': { color: 'green', note: '', is_makeup: false },
    '2026-08-15': { color: 'red', note: '', is_makeup: true },
    '2026-08-14': { color: 'green', note: '', is_makeup: false }
  };
  const s = L.computeStats(records, now);
  assert.strictEqual(s.streak, 1); // 15 补签破戒中断
  assert.strictEqual(s.cultivation, 10); // 当日绿 16、14 各 +5，补签红 15 不生效
});

test('getCultivationQuote 基础映射', () => {
  assert.strictEqual(L.getCultivationQuote(9), '善恶一时妄念，荣枯都不关心');
  assert.strictEqual(L.getCultivationQuote(18), '无念方能静，静中气自平');
  assert.strictEqual(L.getCultivationQuote(27), '神驭气，气留形，不须杂术自长生');
  assert.strictEqual(L.getCultivationQuote(36), '损之又损慎前功');
  assert.strictEqual(L.getCultivationQuote(45), '死生宠辱不须惊');
  assert.strictEqual(L.getCultivationQuote(54), '四方上下同一空，千古万古无初终');
  assert.strictEqual(L.getCultivationQuote(63), '万物芸芸各返根，返根复命即长存');
  assert.strictEqual(L.getCultivationQuote(72), '为仙为佛与为儒，三教单传一个虚');
  assert.strictEqual(L.getCultivationQuote(81), '此身早化飘萍去，独向鸿蒙顶上看');
});

test('getCultivationQuote 循环规则（>81）', () => {
  assert.strictEqual(L.getCultivationQuote(90), '善恶一时妄念，荣枯都不关心');
  assert.strictEqual(L.getCultivationQuote(99), '无念方能静，静中气自平');
  assert.strictEqual(L.getCultivationQuote(108), '神驭气，气留形，不须杂术自长生');
  assert.strictEqual(L.getCultivationQuote(162), '此身早化飘萍去，独向鸿蒙顶上看');
});

test('getCultivationQuote 非法值返回 null', () => {
  assert.strictEqual(L.getCultivationQuote(0), null);
  assert.strictEqual(L.getCultivationQuote(-9), null);
  assert.strictEqual(L.getCultivationQuote(10), null);
  assert.strictEqual(L.getCultivationQuote(null), null);
  assert.strictEqual(L.getCultivationQuote(undefined), null);
});
