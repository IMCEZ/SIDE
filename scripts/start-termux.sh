#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-dev}"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-3000}"
CLIENT_PORT="${CLIENT_PORT:-5173}"

cd "$ROOT_DIR"

fail() {
  printf '错误: %s\n' "$1" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "未检测到 $1。"
}

ensure_termux_packages() {
  if ! command -v node >/dev/null 2>&1; then
    printf '未检测到 Node.js，尝试通过 pkg 安装...\n'
    pkg update -y
    pkg install -y nodejs-lts
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    if command -v corepack >/dev/null 2>&1; then
      printf '未检测到 pnpm，尝试通过 corepack 启用...\n'
      corepack enable
      corepack prepare pnpm@latest --activate
    else
      printf '未检测到 pnpm，尝试通过 npm 安装...\n'
      npm install -g pnpm
    fi
  fi
}

ensure_deps() {
  if [ ! -d "$ROOT_DIR/node_modules" ]; then
    printf '未检测到依赖，正在执行 pnpm install...\n'
    pnpm install
  fi
}

ensure_env() {
  mkdir -p "$ROOT_DIR/server/data"
  if [ ! -f "$ROOT_DIR/server/.env" ]; then
    cp "$ROOT_DIR/server/.env.example" "$ROOT_DIR/server/.env"
    printf '已生成 server/.env，请先检查 JWT_SECRET。\n'
  fi
}

print_access() {
  printf '\n本机浏览器: http://127.0.0.1:%s\n' "$1"
  printf '局域网访问: http://<你的手机局域网IP>:%s\n' "$1"
  printf '如需读取共享存储，可执行 termux-setup-storage。\n\n'
}

run_dev() {
  print_access "$CLIENT_PORT"
  SERVER_HOST="$HOST" PORT="$PORT" CLIENT_DEV_PORT="$CLIENT_PORT" VITE_HOST="$HOST" VITE_PORT="$CLIENT_PORT" VITE_API_TARGET="http://127.0.0.1:$PORT" pnpm dev
}

run_build() {
  pnpm build
  printf '\n构建完成。随后可执行 bash scripts/start-termux.sh start 启动生产模式。\n'
}

run_start() {
  print_access "$PORT"
  PORT="$PORT" SERVER_HOST="$HOST" NODE_ENV=production pnpm start
}

printf '\nSIDE Termux 启动脚本 (%s)\n\n' "$MODE"
ensure_termux_packages
need_cmd node
need_cmd pnpm
ensure_deps
ensure_env

case "$MODE" in
  dev)
    run_dev
    ;;
  build)
    run_build
    ;;
  start)
    run_start
    ;;
  *)
    fail "不支持的模式: $MODE。可用模式: dev | build | start"
    ;;
esac
