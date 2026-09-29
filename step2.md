# Step 2：本地 Express API

## 这一步做了什么

用 Node.js 自带的 `node:sqlite` 写了本地 API，端口 `3000`。数据库在启动时执行 `schema.sql`。没有管理员时，用 `server/.env` 里的账号创建第一条，密码只存哈希。

已在本机测过：登录、新建、公开读取、阅读量 +1、评论里的 `<script>` 会被转义、未登录访问后台返回 401、删除。中文用 UTF-8 写入后再读出正常。

## 产出文件

- `E:\blog\blog2.0\server\package.json`
- `E:\blog\blog2.0\server\index.js`
- `E:\blog\blog2.0\server\db.js`
- `E:\blog\blog2.0\server\.env.example`
- `E:\blog\blog2.0\server\.env`（已被 gitignore，不要提交）
- `E:\blog\blog2.0\.gitignore`
- `E:\blog\blog2.0\uploads\.gitkeep`
- 运行后生成 `E:\blog\blog2.0\data\blog.db`

## 启动

```bash
cd E:/blog/blog2.0/server
npm install
npm start
```

开发时自动重载：`npm run dev`。

本地账号在 `server/.env`：用户名 `admin`，密码 `admin123`。

## 公开接口

不需要登录。文章字段名与 Front-matter 一致：`published`、`image`、`category`、`tags`、`pinned`、`priority`。公开接口不返回 `password`，列表默认不带正文。

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/posts` | 已发布文章。可用 `category`、`tag`、`q` |
| GET | `/api/posts/:slug` | 单篇，含正文。草稿返回 404 |
| POST | `/api/posts/:slug/view` | 阅读量 +1 |
| GET | `/api/posts/:slug/comments` | 可见评论 |
| POST | `/api/posts/:slug/comments` | 发评论。昵称和内容必填，内容会做 HTML 转义 |

## 后台接口

请求头：`Authorization: Bearer <token>`。先 `POST /api/admin/login`，正文 `{"username","password"}`。

| 方法 | 路径 | 作用 |
|---|---|---|
| POST | `/api/admin/login` | 返回 token，7 天 |
| GET | `/api/admin/me` | 检查登录 |
| GET / POST | `/api/admin/posts` | 含草稿的列表 / 新建 |
| GET / PUT / DELETE | `/api/admin/posts/:id` | 详情 / 更新 / 删除 |
| POST | `/api/admin/upload` | 上传图片，表单字段名 `file`，返回 `{ url }` |
| GET | `/api/admin/comments` | 评论列表，可带 `postId` |
| PATCH / DELETE | `/api/admin/comments/:id` | 改状态（`visible` / `hidden` / `pending`）或删除 |

图片文件在 `uploads/`，通过 `/uploads/...` 访问。

## 还没做

`server/index.js` 里计划加的本地 CORS（允许 `localhost` / `127.0.0.1`）没有写进去。前台页面和 API 不同端口时，浏览器会拦请求。这是 Step 4 要补的。

## 下一步

Step 3 已做完：把副本里的 Markdown 导入数据库。见 `step3.md`。
