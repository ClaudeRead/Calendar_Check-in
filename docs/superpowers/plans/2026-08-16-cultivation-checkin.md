# 修仙打卡器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个「修仙戒律」主题的日历打卡 PWA（纯静态、零后端），部署到 GitHub Pages 子路径，支持 23:00–23:30 打卡窗口、红/绿自选、每日记录、双通道提醒（页面弹窗 + Server酱微信推送）。

**Architecture:** 原生 HTML/CSS/JS 静态站点，无构建步骤。核心日期/统计逻辑抽到可测试的 `logic.js`（UMD，浏览器 + Node 通用），用 `node:test` 做单元测试。数据存 `localStorage`，PWA 用 manifest + Service Worker，关浏览器提醒用 GitHub Actions 定时 + Server酱。

**Tech Stack:** 原生 JavaScript（ES5/ES6）、CSS3、HTML5、Node.js `node:test`（仅测试）、GitHub Actions、Server酱 API。

**Spec:** `docs/superpowers/specs/2026-08-16-cultivation-checkin-design.md`

**参考仓库:** `https://github.com/ClaudeRead/Calendar_Check-in.git`（部署地址 `https://clauderead.github.io/Calendar_Check-in/`）

---

## 文件结构

```
DeepSeekProject/  (= 仓库 Calendar_Check-in)
├── index.html
├── style.css
├── logic.js                 # 纯逻辑（UMD，可测试）
├── app.js                   # 日历 + 打卡 + 统计 + localStorage
├── reminder.js              # 页面内弹窗 + 倒计时 + 浏览器通知
├── sw.js                    # Service Worker
├── manifest.webmanifest
├── icons/                   # 脚本生成的 PNG 图标
├── scripts/generate-icons.mjs
├── tests/logic.test.js
├── .github/workflows/remind.yml
├── package.json
├── .gitignore
└── README.md
```

- 所有静态资源用**相对路径**（`./`），保证子路径部署正确。
- 脚本加载顺序：`logic.js` → `app.js` → `reminder.js` → 内联 SW 注册。

---

## Task 0: 脚手架与 git 远程

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`（先写骨架，Task 8 补全）

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "calendar-check-in",
  "version": "1.0.0",
  "private": true,
  "description": "修仙打卡器 - 可爱画风日历打卡 PWA",
  "scripts": {
    "test": "node --test tests/",
    "icons": "node scripts/generate-icons.mjs"
  }
}
```

- [ ] **Step 2: 写 .gitignore**

```
node_modules/
.DS_Store
*.log
```

- [ ] **Step 3: 连接远程仓库并提交**

```bash
git remote add origin https://github.com/ClaudeRead/Calendar_Check-in.git
git add -A
git commit -m "chore: scaffold project"
```

---

## Task 1: 核心逻辑 logic.js（TDD）

**Files:**
- Create: `logic.js`
- Test: `tests/logic.test.js`

- [ ] **Step 1: 写失败测试 `tests/logic.test.js`**

```js
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
  assert.strictEqual(s.streak, 2); // 16,15 绿；14 红中断
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/`
Expected: FAIL（`Cannot find module '../logic.js'`）

- [ ] **Step 3: 实现 logic.js**

```js
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/`
Expected: PASS（9/9）

- [ ] **Step 5: 提交**

```bash
git add logic.js tests/logic.test.js package.json .gitignore README.md
git commit -m "feat: add testable core date/stat logic"
```

---

## Task 2: PWA 图标生成

**Files:**
- Create: `scripts/generate-icons.mjs`
- Create（运行后生成）: `icons/icon-192.png`, `icons/icon-512.png`, `icons/maskable-512.png`

- [ ] **Step 1: 写图标生成脚本（纯 Node，无依赖）**

```js
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'icons');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  const typeBuf = Buffer.from(type, 'ascii');
  out.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 8 + data.length);
  return out;
}

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function roundedRectAlpha(x, y, size, radius) {
  if (radius <= 0) return 1;
  const min = radius, max = size - radius;
  const cx = Math.max(min, Math.min(x, max));
  const cy = Math.max(min, Math.min(y, max));
  const dx = x - cx, dy = y - cy;
  return (dx * dx + dy * dy <= radius * radius) ? 1 : 0;
}

function drawPanda(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const bg = [93, 187, 143], bgTop = [126, 214, 168];
  const face = [255, 255, 255], dark = [58, 46, 42], blush = [244, 164, 164];
  const radius = maskable ? 0 : size * 0.22;
  const faceR = size * 0.34, faceCy = size * 0.55;
  const earR = size * 0.13, earDx = size * 0.24, earDy = size * 0.20;
  const eyeR = size * 0.075, eyeDx = size * 0.11, eyeDy = size * 0.53, pupilR = size * 0.028;
  const blushR = size * 0.045;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const alpha = Math.round(255 * roundedRectAlpha(x + 0.5, y + 0.5, size, radius));
      const t = y / size;
      let r = Math.round(bg[0] + (bgTop[0] - bg[0]) * t);
      let g = Math.round(bg[1] + (bgTop[1] - bg[1]) * t);
      let b = Math.round(bg[2] + (bgTop[2] - bg[2]) * t);
      const px = x + 0.5, py = y + 0.5;
      const e1 = (px - (cx - earDx)) ** 2 + (py - (cx - earDy)) ** 2;
      const e2 = (px - (cx + earDx)) ** 2 + (py - (cx - earDy)) ** 2;
      if (e1 <= earR * earR || e2 <= earR * earR) { r = dark[0]; g = dark[1]; b = dark[2]; }
      const f = (px - cx) ** 2 + (py - faceCy) ** 2;
      if (f <= faceR * faceR) { r = face[0]; g = face[1]; b = face[2]; }
      const ep1 = (px - (cx - eyeDx)) ** 2 + (py - eyeDy) ** 2;
      const ep2 = (px - (cx + eyeDx)) ** 2 + (py - eyeDy) ** 2;
      if (ep1 <= eyeR * eyeR || ep2 <= eyeR * eyeR) { r = dark[0]; g = dark[1]; b = dark[2]; }
      if (ep1 <= pupilR * pupilR || ep2 <= pupilR * pupilR) { r = 255; g = 255; b = 255; }
      const bl1 = (px - (cx - eyeDx - size * 0.04)) ** 2 + (py - (eyeDy + size * 0.10)) ** 2;
      const bl2 = (px - (cx + eyeDx + size * 0.04)) ** 2 + (py - (eyeDy + size * 0.10)) ** 2;
      if (bl1 <= blushR * blushR || bl2 <= blushR * blushR) { r = blush[0]; g = blush[1]; b = blush[2]; }
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = alpha;
    }
  }
  return rgba;
}

mkdirSync(outDir, { recursive: true });
[['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true]].forEach(([name, size, mask]) => {
  writeFileSync(join(outDir, name), encodePNG(size, drawPanda(size, mask)));
  console.log('wrote', name);
});
```

- [ ] **Step 2: 运行脚本生成图标**

Run: `node scripts/generate-icons.mjs`
Expected: 输出 `wrote icon-192.png` / `icon-512.png` / `maskable-512.png`，`icons/` 下出现 3 个 PNG。

- [ ] **Step 3: 提交**

```bash
git add scripts/generate-icons.mjs icons/
git commit -m "feat: add generated panda PWA icons"
```

---

## Task 3: index.html

**Files:**
- Create: `index.html`

- [ ] **Step 1: 写 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>修仙打卡器</title>
  <meta name="theme-color" content="#5DBB8F">
  <link rel="manifest" href="./manifest.webmanifest">
  <link rel="icon" href="./icons/icon-192.png">
  <link rel="apple-touch-icon" href="./icons/icon-192.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <div class="bg-decor" aria-hidden="true">
    <span class="cloud c1"></span>
    <span class="cloud c2"></span>
    <span class="cloud c3"></span>
  </div>

  <main class="app">
    <header class="app-header">
      <div class="mascot" aria-hidden="true">🐼</div>
      <h1 class="app-title">修仙打卡器</h1>
      <p class="app-subtitle">每日一修，道心不破</p>
    </header>

    <section class="stats">
      <div class="stat-card stat-green">
        <span class="stat-label">修为值</span>
        <span class="stat-value" id="stat-cultivation">0</span>
        <span class="stat-unit">点</span>
      </div>
      <div class="stat-card stat-purple">
        <span class="stat-label">连续修炼</span>
        <span class="stat-value" id="stat-streak">0</span>
        <span class="stat-unit">天</span>
      </div>
      <div class="stat-card stat-red">
        <span class="stat-label">破戒</span>
        <span class="stat-value" id="stat-break">0</span>
        <span class="stat-unit">次</span>
      </div>
    </section>

    <div class="countdown" id="countdown-box">距打卡 --:--:--</div>

    <section class="calendar">
      <div class="cal-toolbar">
        <button id="prev-btn" class="cal-nav" type="button" aria-label="上个月">‹</button>
        <div class="cal-title-wrap">
          <span id="cal-title" class="cal-title">2026 年 8 月</span>
          <button id="today-btn" class="cal-today" type="button">回今天</button>
        </div>
        <button id="next-btn" class="cal-nav" type="button" aria-label="下个月">›</button>
      </div>
      <div class="cal-week">
        <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
      </div>
      <div class="cal-grid" id="cal-grid"></div>
      <div class="cal-legend">
        <span><i class="dot dot-green"></i> 修为 +1</span>
        <span><i class="dot dot-red"></i> 破戒</span>
        <span><i class="dot dot-empty"></i> 未打卡</span>
      </div>
    </section>

    <footer class="app-footer">
      <p>打卡窗口：每日 23:00 – 23:30 · 过去日期可随时补卡</p>
    </footer>
  </main>

  <div class="modal-backdrop" id="modal-backdrop">
    <div class="modal" id="modal" role="dialog" aria-modal="true">
      <button class="modal-close" id="modal-close" type="button" aria-label="关闭">✕</button>
      <h2 class="modal-title" id="modal-title">打卡</h2>
      <div class="modal-colors">
        <button id="color-green" class="color-btn color-green" type="button">
          <span class="color-emoji">🟢</span><span class="color-text">修为 +1</span>
        </button>
        <button id="color-red" class="color-btn color-red" type="button">
          <span class="color-emoji">🔴</span><span class="color-text">破戒</span>
        </button>
      </div>
      <label class="note-label" for="note-input">今日记录（可选）</label>
      <textarea id="note-input" class="note-input" rows="3" placeholder="写点什么，比如：打坐 1 小时 / 没忍住吃了夜宵…"></textarea>
      <p class="window-hint" id="window-hint"></p>
      <div class="modal-actions">
        <button id="delete-btn" class="btn btn-ghost" type="button">删除记录</button>
        <button id="save-btn" class="btn btn-primary" type="button">保存打卡</button>
      </div>
    </div>
  </div>

  <div class="reminder-pop" id="reminder-pop">
    <div class="reminder-card">
      <button class="reminder-close" id="reminder-close" type="button" aria-label="关闭">✕</button>
      <div class="reminder-panda" aria-hidden="true">🐼</div>
      <div class="reminder-bubble">
        <p class="reminder-text">道友！时辰到啦~</p>
        <p class="reminder-sub">23:00–23:30 打卡，今日修为 +1 等你拿！</p>
      </div>
      <div class="reminder-actions">
        <button id="reminder-later" class="btn btn-ghost" type="button">稍后再说</button>
        <button id="reminder-go" class="btn btn-primary" type="button">去打卡 ✨</button>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script src="./logic.js"></script>
  <script src="./app.js"></script>
  <script src="./reminder.js"></script>
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').catch(function (e) {
          console.warn('SW registration failed:', e);
        });
      });
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: 提交**

```bash
git add index.html
git commit -m "feat: add app shell markup"
```

---

## Task 4: style.css（可爱画风）

**Files:**
- Create: `style.css`

- [ ] **Step 1: 写 style.css**

```css
:root {
  --cream: #FBF6EC;
  --card: #FFFFFF;
  --ink: #4A3B32;
  --ink-soft: #8C7B70;
  --green: #5DBB8F;
  --green-soft: #E6F5EC;
  --red: #E86A6A;
  --red-soft: #FDEBEB;
  --purple: #A98BE0;
  --purple-soft: #F1ECFB;
  --gold: #E8C87A;
  --shadow: 0 8px 24px rgba(120, 90, 60, 0.10);
  --radius: 22px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body { height: 100%; }

body {
  font-family: "ZCOOL KuaiLe", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;
  color: var(--ink);
  background:
    radial-gradient(circle at 15% 10%, rgba(169, 139, 224, 0.12), transparent 40%),
    radial-gradient(circle at 85% 20%, rgba(93, 187, 143, 0.14), transparent 42%),
    linear-gradient(180deg, #FFF9F0, var(--cream));
  min-height: 100vh;
  padding: 24px 16px 48px;
  -webkit-font-smoothing: antialiased;
}

.bg-decor { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
.cloud {
  position: absolute; width: 90px; height: 34px;
  background: rgba(255, 255, 255, 0.7); border-radius: 40px;
  box-shadow: 0 6px 14px rgba(120, 90, 60, 0.06);
}
.cloud::before, .cloud::after {
  content: ""; position: absolute; background: inherit; border-radius: 50%;
}
.cloud::before { width: 40px; height: 40px; left: 16px; top: -20px; }
.cloud::after { width: 30px; height: 30px; right: 16px; top: -14px; }
.c1 { top: 8%; left: 6%; animation: float 9s ease-in-out infinite; }
.c2 { top: 24%; right: 8%; animation: float 11s ease-in-out infinite 1.5s; }
.c3 { top: 4%; left: 55%; animation: float 10s ease-in-out infinite 3s; }
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-14px); }
}

.app { position: relative; z-index: 1; max-width: 460px; margin: 0 auto; }

.app-header { text-align: center; margin-bottom: 20px; }
.mascot {
  font-size: 64px; line-height: 1;
  display: inline-block; animation: bob 3.2s ease-in-out infinite;
}
@keyframes bob {
  0%, 100% { transform: translateY(0) rotate(-3deg); }
  50% { transform: translateY(-8px) rotate(3deg); }
}
.app-title { font-size: 34px; letter-spacing: 2px; color: var(--ink); }
.app-subtitle { color: var(--ink-soft); margin-top: 4px; letter-spacing: 1px; }

.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
.stat-card {
  background: var(--card); border-radius: var(--radius); padding: 16px 8px;
  text-align: center; box-shadow: var(--shadow);
  border-top: 4px solid var(--green);
}
.stat-green { border-top-color: var(--green); }
.stat-purple { border-top-color: var(--purple); }
.stat-red { border-top-color: var(--red); }
.stat-label { display: block; font-size: 14px; color: var(--ink-soft); }
.stat-value { display: inline-block; font-size: 34px; line-height: 1.2; color: var(--ink); }
.stat-unit { font-size: 13px; color: var(--ink-soft); margin-left: 2px; }

.countdown {
  text-align: center; padding: 12px; margin-bottom: 16px;
  background: linear-gradient(135deg, #FFF6E0, #FFF0F0);
  border-radius: 16px; font-size: 15px; color: var(--ink);
  box-shadow: var(--shadow); letter-spacing: 1px;
}

.calendar { background: var(--card); border-radius: var(--radius); padding: 18px 14px; box-shadow: var(--shadow); }
.cal-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.cal-nav {
  width: 38px; height: 38px; border: none; border-radius: 12px; cursor: pointer;
  background: var(--purple-soft); color: var(--purple); font-size: 24px; line-height: 1;
}
.cal-nav:hover { background: var(--purple); color: #fff; }
.cal-title-wrap { display: flex; align-items: center; gap: 10px; }
.cal-title { font-size: 20px; letter-spacing: 1px; }
.cal-today {
  border: none; background: var(--green-soft); color: var(--green);
  border-radius: 10px; padding: 5px 10px; cursor: pointer; font-size: 13px;
  font-family: inherit;
}
.cal-week { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; color: var(--ink-soft); font-size: 13px; margin-bottom: 6px; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
.day-cell {
  position: relative; aspect-ratio: 1; border: none; background: transparent;
  border-radius: 14px; cursor: pointer; font-family: inherit; font-size: 16px; color: var(--ink);
  display: flex; align-items: center; justify-content: center;
  transition: transform .12s ease, background .12s ease;
}
.day-cell:hover { background: var(--green-soft); transform: translateY(-2px); }
.day-cell.blank { pointer-events: none; }
.day-cell.future { color: #D8CFC4; cursor: default; }
.day-cell.future:hover { background: transparent; transform: none; }
.day-cell.today { box-shadow: inset 0 0 0 2px var(--green); }
.day-num { position: relative; z-index: 1; }
.day-dot { position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%); width: 6px; height: 6px; border-radius: 50%; }
.day-dot.dot-green { background: var(--green); }
.day-dot.dot-red { background: var(--red); }
.cal-legend { display: flex; gap: 14px; justify-content: center; margin-top: 14px; color: var(--ink-soft); font-size: 12px; flex-wrap: wrap; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
.dot-green { background: var(--green); }
.dot-red { background: var(--red); }
.dot-empty { background: #E5DCCE; }

.app-footer { text-align: center; color: var(--ink-soft); font-size: 12px; margin-top: 20px; }

/* Modal */
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(74, 59, 50, 0.35);
  display: none; align-items: center; justify-content: center; z-index: 50; padding: 20px;
}
.modal-backdrop.open { display: flex; }
.modal {
  background: #fff; border-radius: 26px; padding: 24px 20px; width: 100%; max-width: 380px;
  position: relative; box-shadow: 0 20px 50px rgba(74, 59, 50, 0.25);
  animation: pop .25s cubic-bezier(.2, 1.4, .4, 1);
}
@keyframes pop { from { transform: scale(.86); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.modal-close { position: absolute; top: 12px; right: 14px; border: none; background: #F3EDE4; color: var(--ink-soft); width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 14px; }
.modal-title { font-size: 22px; text-align: center; margin-bottom: 18px; letter-spacing: 1px; }
.modal-colors { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.color-btn {
  border: 3px solid transparent; border-radius: 18px; padding: 16px 8px; cursor: pointer;
  font-family: inherit; font-size: 16px; display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: var(--green-soft); color: var(--green); transition: transform .12s ease;
}
.color-btn.color-red { background: var(--red-soft); color: var(--red); }
.color-btn.selected { border-color: currentColor; transform: scale(1.03); }
.color-btn:disabled { opacity: .45; cursor: not-allowed; }
.color-emoji { font-size: 28px; }
.note-label { display: block; font-size: 13px; color: var(--ink-soft); margin-bottom: 6px; }
.note-input {
  width: 100%; border: 2px solid #F0E7DA; border-radius: 14px; padding: 12px;
  font-family: inherit; font-size: 15px; resize: vertical; color: var(--ink);
}
.note-input:focus { outline: none; border-color: var(--green); }
.window-hint { font-size: 12px; color: var(--ink-soft); margin-top: 8px; }
.modal-actions { display: flex; gap: 10px; margin-top: 18px; }
.btn { flex: 1; border: none; border-radius: 14px; padding: 13px; cursor: pointer; font-family: inherit; font-size: 16px; letter-spacing: 1px; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-primary { background: var(--green); color: #fff; }
.btn-primary:hover { background: #4CAC82; }
.btn-ghost { background: transparent; color: var(--ink-soft); border: 2px solid #EEE5D8; }
.btn-ghost:hover { background: #FAF4EA; }

/* Reminder popup */
.reminder-pop { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; z-index: 60; padding: 20px; pointer-events: none; }
.reminder-pop.show { display: flex; }
.reminder-card {
  pointer-events: auto; background: #fff; border-radius: 26px; padding: 26px 20px 20px;
  width: 100%; max-width: 340px; text-align: center; position: relative;
  box-shadow: 0 24px 60px rgba(74, 59, 50, 0.28);
  animation: pop .35s cubic-bezier(.2, 1.4, .4, 1);
}
.reminder-close { position: absolute; top: 12px; right: 14px; border: none; background: #F3EDE4; color: var(--ink-soft); width: 30px; height: 30px; border-radius: 50%; cursor: pointer; }
.reminder-panda { font-size: 74px; animation: bob 2.6s ease-in-out infinite; }
.reminder-bubble { position: relative; background: var(--purple-soft); border-radius: 18px; padding: 14px 16px; margin: 8px 0 16px; }
.reminder-bubble::after { content: ""; position: absolute; top: -8px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 16px; height: 16px; background: var(--purple-soft); }
.reminder-text { font-size: 20px; color: var(--ink); }
.reminder-sub { font-size: 13px; color: var(--ink-soft); margin-top: 4px; }
.reminder-actions { display: flex; gap: 10px; }

/* Toast */
.toast {
  position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%) translateY(20px);
  background: rgba(74, 59, 50, 0.92); color: #fff; padding: 12px 20px; border-radius: 30px;
  font-size: 14px; opacity: 0; pointer-events: none; transition: all .3s ease; z-index: 80;
}
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
```

- [ ] **Step 2: 提交**

```bash
git add style.css
git commit -m "feat: add cute cultivation theme styles"
```

---

## Task 5: app.js（日历/打卡/统计）

**Files:**
- Create: `app.js`

- [ ] **Step 1: 写 app.js**

```js
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
  function saveRecords() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records)); }
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
```

- [ ] **Step 2: 提交**

```bash
git add app.js
git commit -m "feat: add calendar rendering and check-in flow"
```

---

## Task 6: reminder.js（弹窗/倒计时/通知）

**Files:**
- Create: `reminder.js`

- [ ] **Step 1: 写 reminder.js**

```js
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
    try {
      var body = '道友，23:00–23:30 记得打卡，今日修为 +1 等你拿~';
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(function (reg) {
          reg.showNotification('⏰ 修仙打卡时间到！', { body: body, icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: 'cultivation-reminder' });
        });
      } else {
        new Notification('⏰ 修仙打卡时间到！', { body: body });
      }
    } catch (e) {}
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
```

- [ ] **Step 2: 提交**

```bash
git add reminder.js
git commit -m "feat: add in-page reminder popup and notifications"
```

---

## Task 7: Service Worker 与 manifest

**Files:**
- Create: `sw.js`
- Create: `manifest.webmanifest`

- [ ] **Step 1: 写 sw.js**

```js
const CACHE = 'cultivation-v1';
const ASSETS = [
  './', './index.html', './style.css', './logic.js', './app.js', './reminder.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((cached) => {
    const fetched = fetch(e.request).then((resp) => {
      if (resp && resp.status === 200 && resp.type === 'basic') {
        const clone = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
      }
      return resp;
    }).catch(() => cached);
    return cached || fetched;
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
```

- [ ] **Step 2: 写 manifest.webmanifest**

```json
{
  "name": "修仙打卡器",
  "short_name": "修仙打卡",
  "description": "每日一修，道心不破",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#FBF6EC",
  "theme_color": "#5DBB8F",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "./icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: 提交**

```bash
git add sw.js manifest.webmanifest
git commit -m "feat: add service worker and web manifest"
```

---

## Task 8: GitHub Actions 定时推送 + README

**Files:**
- Create: `.github/workflows/remind.yml`
- Modify: `README.md`（补全）

- [ ] **Step 1: 写 remind.yml（用 Secret，绝不硬编码 token）**

```yaml
name: Cultivation Reminder

on:
  schedule:
    - cron: '0 15 * * *'   # 15:00 UTC = 北京时间 23:00
  workflow_dispatch: {}     # 手动触发，便于测试

jobs:
  remind:
    runs-on: ubuntu-latest
    steps:
      - name: Send ServerChan reminder
        env:
          SENDKEY: ${{ secrets.SERVERCHAN_SENDKEY }}
        run: |
          echo "Sending cultivation reminder..."
          curl -s -X POST "https://sctapi.ftqq.com/${SENDKEY}.send" \
            --data-urlencode "title=⏰ 修仙打卡提醒" \
            --data-urlencode "desp=道友，时辰到啦！23:00–23:30 记得打卡，今日修为 +1 等你拿，别破戒哦~" \
            || echo "reminder send failed (ignored)"
```

- [ ] **Step 2: 写 README.md**

```markdown
# 修仙打卡器 🐼

可爱画风的日历打卡 PWA。绿色 = 今日修为 +1，红色 = 破戒。

## 功能
- 每日 23:00–23:30 打卡窗口（窗口前/后显示倒计时）
- 过去日期任意时间补卡，红/绿自选
- 每个日期可记录文字备注
- 双通道提醒：页面开启弹可爱弹窗 + 浏览器通知；关浏览器时 GitHub Actions + Server酱 推微信
- 统计面板：修为值 / 连续修炼天数 / 破戒次数

## 本地运行
```bash
python -m http.server 8000
# 打开 http://localhost:8000
```

## 测试
```bash
node --test tests/
```

## 部署到 GitHub Pages
1. 推送代码到仓库 `ClaudeRead/Calendar_Check-in`。
2. 仓库 Settings → Pages → Source 选 `main` 分支根目录 → Save。
3. 访问 `https://clauderead.github.io/Calendar_Check-in/`。

## 配置微信提醒（Server酱）
1. 仓库 Settings → Secrets and variables → Actions → New repository secret。
2. Name 填 `SERVERCHAN_SENDKEY`，Value 填你的 Server酱 SendKey。
3. 定时任务每天北京时间 23:00 触发（GitHub 免费仓库可能有数分钟延迟）。
4. 可在 Actions 页面手动 Run workflow 测试推送。

> 提醒：打卡记录只存在浏览器本地（不跨设备）；微信推送是纯提醒，无法判断你是否已打卡。
```

- [ ] **Step 3: 提交**

```bash
git add .github/workflows/remind.yml README.md
git commit -m "feat: add scheduled ServerChan reminder and docs"
```

---

## Task 9: 验证

- [ ] **Step 1: 跑单元测试**

Run: `node --test tests/`
Expected: 全部 PASS（9 项）

- [ ] **Step 2: 本地启动 + 手动检查**

Run: `python -m http.server 8000`（或 `npx serve`），浏览器打开 `http://localhost:8000`。
逐项核对验收标准：
1. 今日非窗口时间 → 保存按钮禁用、显示倒计时。
2. 过去日期 → 可随时补卡，红/绿任选，可写备注。
3. 未来日期 → 点击提示「未来日期不可打卡」。
4. 保存后日历出现对应颜色圆点，统计面板更新。
5. 删除记录后圆点与统计恢复。
6. 编辑已有记录（窗口内重复打卡覆盖）。

- [ ] **Step 3: 验证 PWA**

浏览器 DevTools → Application → 检查 manifest 图标、Service Worker 激活、可安装性（Lighthouse PWA 或直接「安装」）。

- [ ] **Step 4: 提交最终验证后的改动**

```bash
git add -A
git commit -m "test: verify app behavior"
```

---

## Task 10: 推送与上线配置

- [ ] **Step 1: 推送代码到 GitHub**

```bash
git push -u origin main
```
（若提示认证，用浏览器/GitHub CLI 完成认证后重试）

- [ ] **Step 2: 配置 GitHub Pages**（在 GitHub 网页操作）
- Settings → Pages → Source: `Deploy from a branch` → Branch `main` / `(root)` → Save。

- [ ] **Step 3: 配置 Server酱 Secret**（在 GitHub 网页操作）
- Settings → Secrets and variables → Actions → New repository secret → Name `SERVERCHAN_SENDKEY`，Value 填 SendKey。

- [ ] **Step 4: 验证线上**
- 访问 `https://clauderead.github.io/Calendar_Check-in/`。
- Actions 页手动 Run workflow，确认微信收到推送。

---

## 备注

- **密钥安全**：Server酱 SendKey 绝不进入提交历史，仅存为 GitHub Secret（`SERVERCHAN_SENDKEY`）。
- **时区**：页面内窗口/倒计时按用户本地时区；GitHub Actions 推送固定按北京时间 23:00（15:00 UTC）触发。
- **已知限制**：记录存浏览器本地、不跨设备；免费仓库定时任务可能延迟数分钟；浏览器通知需用户授权。
