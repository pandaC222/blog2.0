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

# 真正的崩溃原因是 V8 堆耗尽（"Ineffective mark-compacts near heap limit"），
# 不是随机 SIGABRT。系统有 4G swap，把 Node 堆上限提到 3G，避免构建中途 OOM。
# 不设这个，站点内容一多就稳定失败。
export NODE_OPTIONS="--max-old-space-size=3072"

cd "$SITE_DIR"

# 兜底重试：即使加了堆上限，也可能因内存抖动失败一次。
# 失败时不切 dist，站点始终可用。
OUT_DIR="$APP_ROOT/dist-build"
run_build() {
    rm -rf "$OUT_DIR"
    astro build --outDir "$OUT_DIR"
}
if ! run_build; then
    echo "[rebuild] 第一次构建失败，5 秒后重试"
    sleep 5
    run_build
fi
pagefind --site "$OUT_DIR"

rm -rf dist.old
[ -d dist ] && mv dist dist.old
mv "$OUT_DIR" dist

# 字体子集化脚本写死操作 ../dist，切换完成后再跑，失败不影响页面
node scripts/compress-fonts.js || echo "[rebuild] 字体压缩跳过或失败，不影响页面"

# 旧目录后台清理，别卡住返回
rm -rf dist.old &

echo "[rebuild] 完成 $(date -Is)"
