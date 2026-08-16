# 修仙打卡器 🐼

可爱画风的日历打卡 PWA，数据云端同步，跨浏览器/设备互通。绿色 = 今日修为 +1，红色 = 破戒 −1。

## 功能
- 每日 23:00–23:30 打卡窗口（窗口前/后显示倒计时）
- 过去日期任意时间补卡，红/绿自选，每个日期可写备注
- 绿色打卡二次确认：确认「今日没有破戒」才 +1，选「否」则锁定绿色、强制红卡 −1
- 修为值 = 绿色次数 − 红色次数；达到 9 的倍数时弹出对应修仙名言（>81 循环）
- 双通道提醒：页面开启弹可爱弹窗 + 浏览器通知；关浏览器时 GitHub Actions + Server酱 推微信（已打卡自动跳过）
- 自定义背景图 / 图标（填 URL，云端同步）
- 邮箱登录，数据存 Supabase 云端，换浏览器登录同一账号即同步

## 技术栈
原生 HTML/CSS/JS + Supabase（数据库/登录） + GitHub Pages + GitHub Actions + Server酱。

## 本地运行
```bash
python -m http.server 8000
# 打开 http://localhost:8000
```

## 测试
```bash
node --test tests/
```

## 首次部署步骤（重要）

### 1. 建数据库表
1. 登录 [Supabase](https://supabase.com) → 打开你的项目。
2. 左侧 **SQL Editor** → **New query** → 粘贴 `supabase-schema.sql` 全部内容 → **Run**。
   （会创建 `records`、`settings` 两张表并开启行级权限）

### 2. 配置前端连接
`supabase-config.js` 已填好你的 Project URL 和 publishable key，无需改动。

### 3. 部署到 GitHub Pages
仓库 Settings → Pages → Source 选 `main` 分支根目录 → Save。
访问 `https://clauderead.github.io/Calendar_Check-in/`。

### 4. 配置 GitHub Actions 密钥（微信提醒）
仓库 Settings → Secrets and variables → Actions → New repository secret，添加三个：

| Name | Value |
|---|---|
| `SERVERCHAN_SENDKEY` | 你的 Server酱 SendKey |
| `SUPABASE_URL` | `https://esoxzxhxeaazyblkbrvq.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase 的 secret key（`sb_secret_...`，仅用于提醒任务判断是否已打卡） |

> `SUPABASE_URL` 和 `SUPABASE_SERVICE_KEY` 用于「已打卡则跳过微信提醒」。若不配置，提醒任务会退化为「到点必推」，不影响其他功能。

### 5. 测试
- 首次打开页面 → 点「注册」→ 查收邮箱确认 → 登录 → 开始打卡。
- Actions 页手动 Run workflow 测试微信推送。

## 说明
- 打卡记录存 Supabase 云端，仅本人（登录账号）可读写。
- 微信推送为纯提醒；页面内弹窗/通知按用户本地时区。
