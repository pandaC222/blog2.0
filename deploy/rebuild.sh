#!/usr/bin/env bash
# 重建前台静态站。后端 REBUILD_CMD 指向本脚本。
#
# 两个关键点：
#   1. 先建到 dist.tmp，成功后再原子切换 —— 构建要几十秒到几分钟，
#      直接覆盖 dist 的话这段时间前台会 404 或半残。
#   2. 跳过 pnpm build 里的 update-anime.mjs，那一步要联网抓 Bangumi/B 站，
#      放在自动重建里只会白白失败；番剧数据要更新就手动跑一次。
set -euo pipefail

APP_ROOT=/opt/blog
SITE_DIR="$APP_ROOT/pandaC222.github.io"
# astro.config 的 site 由它决定，sitemap / RSS / OG 图都依赖。
# 后台触发的构建会从 systemd 继承到；手动跑时从 server/.env 里读。
if [ -z "${SITE_URL:-}" ] && [ -f "$APP_ROOT/server/.env" ]; then
    SITE_URL=$(sed -n 's/^SITE_URL=//p' "$APP_ROOT/server/.env" | head -1)
fi
export SITE_URL="${SITE_URL:-https://example.com}"
export NODE_ENV=production
export PATH="$SITE_DIR/node_modules/.bin:$PATH"

cd "$SITE_DIR"

rm -rf dist.tmp
astro build --outDir dist.tmp
pagefind --site dist.tmp

rm -rf dist.old
[ -d dist ] && mv dist dist.old
mv dist.tmp dist

# 字体子集化脚本写死操作 ../dist，切换完成后再跑，失败不影响页面
node scripts/compress-fonts.js || echo "[rebuild] 字体压缩跳过或失败，不影响页面"

# 旧目录后台清理，别卡住返回
rm -rf dist.old &

echo "[rebuild] 完成 $(date -Is)"
