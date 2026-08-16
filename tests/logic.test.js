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
});

test('computeStats 今日未打卡从昨天起算', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  const records = {
    '2026-08-15': { color: 'green', note: '' },
    '2026-08-14': { color: 'green', note: '' },
    '2026-08-13': { color: 'green', note: '' }
  };
  assert.strictEqual(L.computeStats(records, now).streak, 3);
});

test('computeStats 今日破戒连续天数为 0', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  const records = {
    '2026-08-16': { color: 'red', note: '' },
    '2026-08-15': { color: 'green', note: '' }
  };
  const s = L.computeStats(records, now);
  assert.strictEqual(s.streak, 0);
  assert.strictEqual(s.totalRed, 1);
});
