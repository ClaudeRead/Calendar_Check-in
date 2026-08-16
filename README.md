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
