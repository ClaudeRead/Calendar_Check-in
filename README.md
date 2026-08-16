# 修仙打卡器 🐼

> 可爱画风的日历打卡 PWA —— 每日一修，道心不破。
> 绿色 = 今日修为 +1，红色 = 破戒 −1。数据云端同步，跨浏览器 / 跨设备互通。

## 🔗 访问网址

- **在线使用**：<https://clauderead.github.io/Calendar_Check-in/>
- **源码仓库**：<https://github.com/ClaudeRead/Calendar_Check-in>

## ✨ 功能特性

- ⏰ **打卡窗口**：每日 23:00–23:30 开放打卡（窗口前 / 后显示实时倒计时）
- 📅 **自由补卡**：过去日期任意时间补卡，红 / 绿自选，每个日期可写文字备注
- 🟢 **绿色二次确认**：点绿色先弹「确定今日没有破戒？」——选「是」修为 +1；选「否」锁定绿色、强制红卡 −1
- 🧘 **修为值系统**：修为值 = 绿色次数 − 红色次数；达到 9 的倍数时弹出对应修仙名言（>81 自动循环）
- 🔔 **双通道提醒**：页面开启时弹可爱弹窗 + 浏览器通知；关浏览器时 GitHub Actions + Server酱 推微信（已打卡自动跳过）
- 🎨 **自定义外观**：背景图 / 图标填 URL 即可，云端同步
- ☁️ **云端同步**：邮箱登录，数据存 Supabase，换浏览器登录同一账号即互通
- 📱 **PWA**：可安装到桌面 / 手机，有离线缓存与专属图标

## 🚀 快速开始（日常使用）

1. 打开访问网址：<https://clauderead.github.io/Calendar_Check-in/>
2. 首次使用点「**注册**」→ 查收邮箱确认邮件 → 「**登录**」
3. 之后打开网址即自动登录，数据跨浏览器 / 设备自动同步
4. 每天 23:00–23:30 打卡；补卡点日历里过去的日期即可

> 💡 建议安装为桌面 / 手机应用（浏览器菜单 →「安装」/「添加到主屏幕」），体验更好。

## 🎨 打卡规则

| 操作 | 效果 |
|---|---|
| 绿色打卡（确认「没破戒」） | 修为 +1 |
| 绿色打卡（选「否，破戒了」） | 锁定绿色 → 强制红卡 → 修为 −1 |
| 红色打卡（破戒） | 修为 −1，连续修炼中断 |
| 今日非窗口时间 | 按钮禁用，显示倒计时 |
| 过去日期 | 任意时间可补卡 |
| 未来日期 | 锁定 |

## 🛠 技术栈

原生 HTML / CSS / JavaScript（无构建、零后端）+ Supabase（数据库 / 登录）+ GitHub Pages（托管）+ GitHub Actions（定时提醒）+ Server酱（微信推送）。

## 💻 本地开发

```bash
# 启动本地服务（需 http 环境，PWA/Service Worker 才能生效）
python -m http.server 8000
# 打开 http://localhost:8000
```

```bash
# 运行单元测试（需 Node.js 18+）
node --test tests/
```

## 📦 部署与配置（仅首次部署需要）

### 1. 建数据库表（Supabase）
1. 登录 [Supabase](https://supabase.com) → 打开你的项目。
2. 左侧 **SQL Editor** → **New query** → 粘贴 `supabase-schema.sql` 全部内容 → **Run**。
   （创建 `records`、`settings` 两张表并开启行级权限，仅本人可读写）

### 2. 部署 GitHub Pages
仓库 Settings → Pages → Source 选 `main` 分支根目录 → Save，即可通过上述访问网址访问。

### 3. 配置 GitHub Actions 密钥（微信提醒）
仓库 Settings → Secrets and variables → Actions → New repository secret，添加：

| Name | Value |
|---|---|
| `SERVERCHAN_SENDKEY` | 你的 Server酱 SendKey |
| `SUPABASE_URL` | `https://esoxzxhxeaazyblkbrvq.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase 的 secret key（`sb_secret_...`） |

> `SUPABASE_URL` 和 `SUPABASE_SERVICE_KEY` 用于「已打卡则跳过微信提醒」。不配置时提醒会退化为「到点必推」，不影响其他功能。

### 4. 测试
- 打开网址 → 注册 → 邮箱确认 → 登录 → 打卡。
- Actions 页手动 Run workflow 测试微信推送。

## 🔐 安全加固

1. **关闭开放注册**（防止陌生人注册占用项目）：
   Supabase → Authentication → Providers → Email → 关闭 **Allow new users to sign up**。
   > 顺序：先在本站注册好你自己的账号，再关闭注册。

2. **轮换 Server酱 SendKey**（若曾在聊天 / 截图公开过）：
   [Server酱](https://sct.ftqq.com) 重新生成，并更新仓库 Secret `SERVERCHAN_SENDKEY`。

3. **开启验证码**（可选）：Supabase → Authentication → Sign In / Providers → 开启 **hCaptcha**。

4. **确认邮箱确认已开启**：Authentication → Providers → Email → 勾选 **Confirm email**。

5. **确认 RLS 已生效**：确认已执行 `supabase-schema.sql`，否则数据可能对外暴露。

代码已内置：内容安全策略（CSP）、URL 协议白名单（背景 / 图标仅 http/https）、密码至少 8 位、用户输入全部文本渲染（防 XSS）。

## 📁 项目结构

```
Calendar_Check-in/
├── index.html              # 页面结构（登录 / 日历 / 各类弹窗）
├── style.css               # 可爱画风样式
├── logic.js                # 纯逻辑（时间窗口 / 统计 / 名言映射，可测试）
├── app.js                  # 登录 / 云同步 / 打卡 / 设置
├── reminder.js             # 页面内弹窗 + 倒计时 + 浏览器通知
├── register-sw.js          # Service Worker 注册
├── sw.js                   # Service Worker（离线缓存 + 通知点击）
├── supabase-config.js      # Supabase 连接配置（公开）
├── supabase-schema.sql     # 建表 + 行级权限脚本
├── vendor/supabase.min.js  # Supabase JS SDK（本地化，不依赖 CDN）
├── scripts/generate-icons.mjs  # PWA 图标生成脚本
├── icons/                  # 生成的熊猫图标
├── tests/logic.test.js     # 单元测试
└── .github/workflows/remind.yml  # 定时微信提醒
```

## 说明

- 打卡记录存 Supabase 云端，仅本人（登录账号）可读写。
- 微信推送为纯提醒；页面内弹窗 / 通知按用户本地时区。
- 项目为个人自用设计：免费额度、单账号即可满足日常使用。
