# blog2.0

Astro + Mizuki 前台 + Express/SQLite 后端的动态博客。本地开发环境，尚未部署。

## 结构

```
admin/                  后台单页应用（HTML + 原生 JS，由 Express 直接提供）
server/                 Express API（Node.js + node:sqlite）
schema.sql              SQLite 表结构
data/                   数据库（blog.db，不入库）
uploads/                上传文件（不入库）
pandaC222.github.io/    前台站点（Astro + Mizuki 主题副本）
step1-5.md              各阶段进度记录
```

## 启动

后端 API（端口 3000）：

```bash
cd server
npm install
npm start          # 或 npm run dev 自动重载
```

首次启动会执行 schema.sql 建表；没有管理员时用 `server/.env` 里的账号创建（参考 `server/.env.example`）。

前台（端口 4321）：

```bash
cd pandaC222.github.io
pnpm install
pnpm dev
```

- 前台：http://localhost:4321/
- 后台：http://localhost:3000/admin（账号在 `server/.env`，默认 admin / admin123）

## 迁移存量文章

```bash
cd server
npm run migrate:test   # 先写入测试库并断言字段
npm run migrate        # 通过后写入正式库 data/blog.db
```

按 `slug` 幂等更新，不会清零已有阅读量。

## 数据流向

- 前台页面由 Astro 服务端渲染，DOM 与原 GitHub Pages 站点一致；阅读量和评论由 `public/blog-dynamic.js` 在浏览器里请求 API。
- 后台保存文章时写回 `pandaC222.github.io/src/content/posts/<slug>.md` 并同步 SQLite；各板块（日记、追番、友链等）整份写回 `src/content/admin/` 下的 yml。
- 图片上传落在站点 `public/uploads/`。
