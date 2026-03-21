#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-dev}"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-3000}"
CLIENT_PORT="${CLIENT_PORT:-5173}"

cd "$ROOT_DIR"

print_header() {
  printf '\nSIDE 启动脚本 (%s)\n\n' "$MODE"
}

fail() {
  printf '错误: %s\n' "$1" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "未检测到 $1，请先安装后重试。"
}

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return
  fi
  if command -v corepack >/dev/null 2>&1; then
    printf '未检测到 pnpm，尝试通过 corepack 启用...\n'
    corepack enable
    corepack prepare pnpm@latest --activate
  elif command -v npm >/dev/null 2>&1; then
    printf '未检测到 pnpm，尝试通过 npm 安装...\n'
    npm install -g pnpm
  else
    fail '未检测到 pnpm，且无法使用 corepack 或 npm 自动安装。'
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
    if [ -f "$ROOT_DIR/server/.env.example" ]; then
      cp "$ROOT_DIR/server/.env.example" "$ROOT_DIR/server/.env"
      printf '已生成 server/.env，请按需修改 JWT_SECRET。\n'
    else
      fail '缺少 server/.env.example，无法初始化环境文件。'
    fi
  fi
}

run_dev() {
  printf '开发模式前端: http://%s:%s\n' "$HOST" "$CLIENT_PORT"
  printf '开发模式后端: http://%s:%s\n\n' "$HOST" "$PORT"
  SERVER_HOST="$HOST" PORT="$PORT" CLIENT_DEV_PORT="$CLIENT_PORT" VITE_HOST="$HOST" VITE_PORT="$CLIENT_PORT" VITE_API_TARGET="http://127.0.0.1:$PORT" pnpm dev
}

run_build() {
  printf '开始构建 client 与 server...\n\n'
  pnpm build
  printf '\n构建完成。client/dist 为前端产物，server/dist 为后端产物。\n'
}

run_start() {
  printf '生产模式访问地址: http://%s:%s\n\n' "$HOST" "$PORT"
  PORT="$PORT" SERVER_HOST="$HOST" NODE_ENV=production pnpm start
}

print_header
need_cmd node
ensure_pnpm
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
