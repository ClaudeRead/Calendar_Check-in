-- 修仙打卡器 · 数据初始化（清空所有打卡记录与设置）
-- 用法：Supabase 控制台 → SQL Editor → 新建查询 → 粘贴全部内容 → Run

-- 清空打卡记录
delete from public.records;

-- 清空用户设置（背景图 / 图标 URL）
delete from public.settings;
