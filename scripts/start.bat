@echo off
setlocal enabledelayedexpansion

rem 切换到脚本所在目录的上级目录（项目根目录：SIDE）
cd /d "%~dp0.."

title SIDE - AI Chat Frontend
echo.
echo  ███████╗██╗██████╗ ███████╗
echo  ██╔════╝██║██╔══██╗██╔════╝
echo  ███████╗██║██║  ██║█████╗
echo  ╚════██║██║██║  ██║██╔══╝
echo  ███████║██║██████╔╝███████╗
echo  ╚══════╝╚═╝╚═════╝ ╚══════╝
echo.
echo  正在启动 SIDE...
echo.

echo  [检查] 正在检测 Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [错误] 未检测到 Node.js，请先安装 Node.js
    echo  下载地址：https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo  [检查] 正在检测 pnpm...
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo  [提示] 未检测到 pnpm，将通过 npm 全局安装 pnpm...
    echo  [执行] npm install -g pnpm
    npm install -g pnpm
    if %errorlevel% neq 0 (
        echo  [错误] 安装 pnpm 失败，请手动执行 "npm install -g pnpm" 后重试。
        echo.
        pause
        exit /b 1
    )
)

echo  [检查] 正在检查依赖（node_modules）...
if not exist "node_modules" (
    echo  [提示] 首次运行，正在安装依赖，请稍候...
    echo  [执行] pnpm install
    pnpm install
    if %errorlevel% neq 0 (
        echo  [错误] 依赖安装失败，请检查上方错误信息。
        echo.
        pause
        exit /b 1
    )
)

if not exist "server\data" mkdir "server\data"

echo  [启动] 正在启动 SIDE 服务...
echo  [提示] 将在默认浏览器中打开 http://localhost:5173
start "" "http://localhost:5173"

echo  [执行] pnpm dev
call pnpm dev
if %errorlevel% neq 0 (
    echo.
    echo  [错误] SIDE 服务启动失败，请检查上方错误日志。
)

echo.
echo  [完成] 脚本执行结束，按任意键退出...
pause
@echo off
title SIDE - AI Chat Frontend
echo.
echo  ███████╗██╗██████╗ ███████╗
echo  ██╔════╝██║██╔══██╗██╔════╝
echo  ███████╗██║██║  ██║█████╗
echo  ╚════██║██║██║  ██║██╔══╝
echo  ███████║██║██████╔╝███████╗
echo  ╚══════╝╚═╝╚═════╝ ╚══════╝
echo.
echo  正在启动 SIDE...
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [错误] 未检测到 Node.js，请先安装 Node.js
    echo  下载地址：https://nodejs.org
    pause
    exit /b 1
)

where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo  [提示] 正在安装 pnpm...
    npm install -g pnpm
)

if not exist "node_modules" (
    echo  [提示] 首次运行，正在安装依赖，请稍候...
    pnpm install
)

if not exist "server\\data" mkdir server\\data

echo  [启动] 正在启动 SIDE 服务...
start "" http://localhost:5173
pnpm dev
pause

