#!/bin/bash
echo ""
echo " ███████╗██╗██████╗ ███████╗"
echo " ██╔════╝██║██╔══██╗██╔════╝"
echo " ███████╗██║██║  ██║█████╗  "
echo " ╚════██║██║██║  ██║██╔══╝  "
echo " ███████║██║██████╔╝███████╗"
echo " ╚══════╝╚═╝╚═════╝ ╚══════╝"
echo ""
echo " 正在启动 SIDE..."
echo ""

if ! command -v node &> /dev/null; then
    echo " [错误] 未检测到 Node.js，请先安装 Node.js"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo " [提示] 正在安装 pnpm..."
    npm install -g pnpm
fi

if [ ! -d "node_modules" ]; then
    echo " [提示] 首次运行，正在安装依赖..."
    pnpm install
fi

mkdir -p server/data

echo " [启动] 正在启动 SIDE 服务..."
pnpm dev

