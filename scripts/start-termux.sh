#!/bin/bash
echo " 正在启动 SIDE (Termux 模式)..."

if ! command -v node &> /dev/null; then
    echo " [提示] 正在通过 pkg 安装 Node.js..."
    pkg install nodejs -y
fi

if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
fi

if [ ! -d "node_modules" ]; then
    pnpm install
fi

mkdir -p server/data

echo " [提示] 服务启动后，请在浏览器访问 http://localhost:5173"
echo " [提示] 可将网页添加到桌面作为 PWA 应用使用"
pnpm dev

