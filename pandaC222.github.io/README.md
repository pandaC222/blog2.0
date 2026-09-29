# pandac'blog

基于 [Mizuki](https://github.com/LyraVoid/Mizuki) 的个人博客。

线上地址：https://pandac222.github.io/

---

## 特别感谢

前端主题来自 **[Mizuki](https://github.com/LyraVoid/Mizuki)**（作者 [LyraVoid](https://github.com/LyraVoid)）。

主题提供了完整的 Astro 博客结构、组件与交互能力。本站在其基础上增加了本地管理后台等功能。  
**特别感谢大佬的开源工作！** 使用同款主题请优先 star / 支持原项目。

---

## 功能

### 站点能力（主题自带 + 本站沿用）

- Astro 静态博客，支持文章、归档、标签/分类
- 多页面模块：友链、项目、技能、时间线、日记、番剧、相册、设备等（可开关）
- Markdown / 代码高亮、搜索、RSS、Sitemap 等

### 本站新增：本地中文管理后台（`/admin/`）

- 本地开发时可视化管理，无需手改大量 YAML / Markdown
- **写文章**：Markdown 编辑 + 实时预览，草稿可在前台隐藏
- **模块编辑**：公告、资料、横幅、模块开关、友链、项目、技能、时间线、日记、番剧、设备、相册等
- **本地保存**：直接写入工作区文件，前台可即时预览
- **推送到 GitHub**：本地改完后一键提交并推送，触发 Pages 部署
- **媒体**：图片上传；日记多图；友链可尝试自动抓取站点图标；番剧可从 B 站链接填充信息
- **时间字段**：支持精确到时分，可一键填入当前时间
- 分类/等级等枚举字段使用下拉选择（技能、项目、时间线等）

> 管理后台的本地写文件与推送能力仅在本机 `pnpm dev` 下可用；线上为静态站点。

---

## 技术栈

- [Astro](https://astro.build/) + [Svelte](https://svelte.dev/)
- Tailwind CSS
- pnpm
- 部署：GitHub Pages

---

## 本地开发

```bash
pnpm install
pnpm dev
```

```bash
pnpm build
pnpm preview
```

---

## 更新流程（推荐）

1. `pnpm dev`
2. 打开 `/admin/` 修改内容并「保存到本地」
3. 前台确认效果
4. 「推送到 GitHub」或手动 `git push`
5. 等待 GitHub Pages 构建完成

---

## 致谢与许可

- 主题原作：[Mizuki](https://github.com/LyraVoid/Mizuki) by [LyraVoid](https://github.com/LyraVoid)  
  请遵循上游仓库的开源许可与署名要求。
- 本仓库在主题之上的管理后台与业务改动，以本仓库为准。
