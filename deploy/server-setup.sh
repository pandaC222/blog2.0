#!/usr/bin/env bash
# 阿里云 Ubuntu 初始化：装 Node 22 / pnpm / nginx / certbot，建目录和 swap。
# 幂等，可以重复跑。
#
#   sudo bash server-setup.sh
#
# 注意：80/443 端口要在阿里云安全组里放行，脚本管不到。
set -euo pipefail

APP_ROOT=/opt/blog
NODE_VER=22.22.0        # node:sqlite 需要 >= 22.5，Astro 6 也要新版本
PNPM_VER=10.22.0        # 站点 package.json 里 packageManager 指定的版本
MIRROR=https://registry.npmmirror.com

log() { echo; echo "==== $* ===="; }

[ "$(id -u)" -eq 0 ] || { echo "请用 root 或 sudo 运行"; exit 1; }

log "系统包"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates xz-utils git nginx

log "Node ${NODE_VER}"
if command -v node >/dev/null 2>&1 && [ "$(node -v)" = "v${NODE_VER}" ]; then
    echo "已是 v${NODE_VER}，跳过"
else
    # 走 npmmirror 的官方二进制镜像，国内下载比 NodeSource 稳
    cd /tmp
    curl -fsSL "${MIRROR}/-/binary/node/v${NODE_VER}/node-v${NODE_VER}-linux-x64.tar.xz" -o node.tar.xz
    tar -xJf node.tar.xz -C /usr/local --strip-components=1
    rm -f node.tar.xz
fi
node -v
npm -v

log "pnpm ${PNPM_VER}"
npm config set registry "$MIRROR"
if ! command -v pnpm >/dev/null 2>&1 || [ "$(pnpm -v)" != "${PNPM_VER}" ]; then
    npm install -g "pnpm@${PNPM_VER}"
fi
pnpm config set registry "$MIRROR"
pnpm -v

log "swap（1C1G 的机器 astro build 会 OOM）"
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "已启用 2G swap"
else
    echo "已存在"
fi
free -h | head -2

log "certbot"
apt-get install -y certbot python3-certbot-nginx

log "目录"
mkdir -p "$APP_ROOT"
echo "$APP_ROOT 已就绪"

log "完成"
cat <<'EOF'
接下来的步骤（代码上传后）：
  1. cd /opt/blog/pandaC222.github.io && pnpm install --frozen-lockfile
  2. 把 server/.env 配好（参考 deploy/.env.production.example）
  3. bash /opt/blog/deploy/rebuild.sh       # 首次构建
  4. cp /opt/blog/deploy/blog.service /etc/systemd/system/
     systemctl daemon-reload && systemctl enable --now blog
  5. sed 's/__DOMAIN__/你的域名/g' deploy/nginx.conf > /etc/nginx/sites-available/blog
     ln -sf /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/blog
     rm -f /etc/nginx/sites-enabled/default
     nginx -t && systemctl reload nginx
  6. certbot --nginx -d 你的域名
EOF
