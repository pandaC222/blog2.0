# 部署说明（阿里云 Ubuntu）

## 现状

| 项 | 值 |
|---|---|
| 服务器 | `<你的服务器 IP>`（Ubuntu 22.04.5，2 核 / 1.7G / 40G） |
| 域名 | `blog.pandac222.cn`（已备案，已解析到服务器） |
| 站点根 | `/opt/blog` |
| 前台 | `/opt/blog/pandaC222.github.io/dist`（nginx 直接托管） |
| 后端 | `systemctl blog`，`node index.js`，监听 127.0.0.1:3000 |
| 数据库 | `/opt/blog/data/blog.db`（WAL 模式） |
| 证书 | Let's Encrypt，`certbot.timer` 自动续期 |
| 登录 | SSH 密钥登录（`<你的登录用户>` + `<你的私钥路径>`），凭据只在本地保存，不入库 |

## 请求怎么走

```
浏览器
  ├─ /            → nginx → dist/ 静态文件（try_files $uri $uri/index.html）
  ├─ /_astro/     → nginx → dist/_astro（1 年强缓存）
  ├─ /uploads/    → nginx alias → pandaC222.github.io/public/uploads/   ← 指向源码，不是 dist
  ├─ /admin       → nginx → Express :3000/admin（后台 SPA）
  └─ /api/        → try_files 先找 dist/api/*.json（Astro 构建产物）
                    找不到 → Express :3000（真接口）
```

`/api/` 这条**必须是 try_files 优先**，不能直接 `proxy_pass`。因为 Astro 构建时会在
`dist/api/` 下生成 `allPostMeta.json` 和 `calendar-data.json`，直接反代会把它们一起送给后端 → 404。

`/uploads/` 指向源码目录而不是 dist，所以**后台传完图立刻可见，不用等重建**。

## 内容怎么生效

前台是 `output: "static"`，改 `.md`/`.yml` 只落盘，**必须重新 build** 才会变。

- 后台保存 → `admin.js` 的 `api()` 检测到 `POST/PUT /api/admin/content/*` → 1.5 秒防抖 → `POST /api/admin/rebuild`
- 后端 spawn `REBUILD_CMD`（= `/opt/blog/deploy/rebuild.sh`），异步跑，不阻塞保存
- 构建期间再保存会排队，跑完补一次，不会丢最后一次改动
- 实测一次重建约 **55–60 秒**，期间前台正常（先建 `dist.tmp` 再原子切换）

## 常用命令

```bash
# 服务
systemctl status blog            # 状态
systemctl restart blog           # 改完后端代码后重启
journalctl -u blog -f            # 实时日志

# 手动重建前台（后台没触发时用）
bash /opt/blog/deploy/rebuild.sh

# nginx
nginx -t && systemctl reload nginx

# 证书
certbot renew --dry-run          # 演练
certbot certificates             # 看有效期

# 数据库备份
sqlite3 /opt/blog/data/blog.db ".backup /root/blog-$(date +%F).db"   # 没装 sqlite3 就直接 cp（先停服务）
```

## 更新代码

下面的命令用三个变量，先按自己的环境赋值（**别把它们写进仓库**）：

```bash
HOST=<你的服务器 IP 或域名>
SSH_USER=<你的登录用户>
SSH_KEY=<你的私钥路径>
```

后端单文件改动可以直接传：

```bash
scp -i "$SSH_KEY" server/index.js "$SSH_USER@$HOST":/opt/blog/server/
ssh -i "$SSH_KEY" "$SSH_USER@$HOST" "systemctl restart blog"
```

前端/后台改动要重新构建：

```bash
# 本地打包（注意排除 .transfer-backup，那两个 zip 有 171MB）
tar czf /tmp/blog-src.tar.gz --exclude='node_modules' --exclude='.astro' --exclude='.git' \
  --exclude='dist' --exclude='.transfer-backup' --exclude='.devin' --exclude='*.bak' \
  admin server deploy schema.sql pandaC222.github.io
scp -i "$SSH_KEY" /tmp/blog-src.tar.gz "$SSH_USER@$HOST":/tmp/
ssh -i "$SSH_KEY" "$SSH_USER@$HOST" "tar xzf /tmp/blog-src.tar.gz -C /opt/blog && bash /opt/blog/deploy/rebuild.sh"
```

> `--exclude='*.bak'` 别省。`src/layouts/Layout.astro.bak` 会被 Vite 当源码扫进去，
> 构建直接报 `Expected "(" but found "ConfigCarrier"`。

## 首次部署步骤（重装时参考）

1. `bash deploy/server-setup.sh`（Node 22.22.0 / pnpm / nginx / certbot / 2G swap）
2. 上传代码到 `/opt/blog`
3. `cd /opt/blog/pandaC222.github.io && pnpm install --frozen-lockfile`
4. `cd /opt/blog/server && npm ci`
5. 写 `server/.env`（见 `deploy/.env.production.example`）
6. `bash deploy/rebuild.sh`
7. `cp deploy/blog.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now blog`
8. `sed 's/__DOMAIN__/域名/g' deploy/nginx.conf > /etc/nginx/sites-available/blog` + 软链 + reload
9. `certbot --nginx -d 域名`

## 踩过的坑

- **Node 装在 `/usr/local/bin/node`**，不是 `/usr/bin/node`。`blog.service` 的 `ExecStart` 写错会 status=203/EXEC。
- **`ADMIN_PASSWORD` 只在「库里没有管理员」时生效**。导入旧库后改它没用，要调 `POST /api/admin/password` 改。
- **slug 大小写/空格不一致**：Astro 生成的路由是归一化的（`AtCoder.md` → `/posts/atcoder/`），
  库里存原文。`getPostBySlug` 已加归一化回退，否则阅读量和评论接口对这类文章全 404。
- **`data/blog.db` 主文件可能只有 4KB**，数据都在 `-wal` 里。迁移前先
  `PRAGMA wal_checkpoint(TRUNCATE)`，否则拷过去是空库。
- 前台评论默认落 `pending`，**要在后台审核后才显示**，这是设计不是 bug。

## 已知的小问题（不影响核心功能）

- 文章页会报 `window.oddmisc.getSiteStats is not a function`（umami 统计集成），
  站点统计数字因此不显示。与部署无关，是主题集成本身的问题。
- 改密后同一秒内签发的旧 token 不会立即失效（JWT `iat` 秒级精度）。
