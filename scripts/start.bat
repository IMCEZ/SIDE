@echo off
setlocal

set "ROOT_DIR=%~dp0.."
cd /d "%ROOT_DIR%"

set "MODE=%~1"
if "%MODE%"=="" set "MODE=dev"
if "%HOST%"=="" set "HOST=0.0.0.0"
if "%PORT%"=="" set "PORT=3000"
if "%CLIENT_PORT%"=="" set "CLIENT_PORT=5173"

echo.
echo SIDE 启动脚本 (%MODE%)
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo 错误: 未检测到 Node.js，请先安装 Node.js 18+ 后重试。
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  where corepack >nul 2>nul
  if not errorlevel 1 (
    echo 未检测到 pnpm，尝试通过 corepack 启用...
    call corepack enable || exit /b 1
    call corepack prepare pnpm@latest --activate || exit /b 1
  ) else (
    echo 未检测到 pnpm，尝试通过 npm 安装...
    call npm install -g pnpm || exit /b 1
  )
)

if not exist "node_modules" (
  echo 未检测到依赖，正在执行 pnpm install...
  call pnpm install || exit /b 1
)

if not exist "server\data" mkdir "server\data"
if not exist "server\.env" (
  if exist "server\.env.example" (
    copy /y "server\.env.example" "server\.env" >nul
    echo 已生成 server\.env，请按需修改 JWT_SECRET。
  ) else (
    echo 错误: 缺少 server\.env.example，无法初始化环境文件。
    exit /b 1
  )
)

if /i "%MODE%"=="dev" goto run_dev
if /i "%MODE%"=="build" goto run_build
if /i "%MODE%"=="start" goto run_start

echo 错误: 不支持的模式 %MODE%。可用模式: dev ^| build ^| start
exit /b 1

:run_dev
echo 开发模式前端: http://%HOST%:%CLIENT_PORT%
echo 开发模式后端: http://%HOST%:%PORT%
echo.
set "SERVER_HOST=%HOST%"
set "CLIENT_DEV_PORT=%CLIENT_PORT%"
set "VITE_HOST=%HOST%"
set "VITE_PORT=%CLIENT_PORT%"
set "VITE_API_TARGET=http://127.0.0.1:%PORT%"
call pnpm dev
exit /b %errorlevel%

:run_build
echo 开始构建 client 与 server...
echo.
call pnpm build
if errorlevel 1 exit /b %errorlevel%
echo.
echo 构建完成。client\dist 为前端产物，server\dist 为后端产物。
exit /b 0

:run_start
echo 生产模式访问地址: http://%HOST%:%PORT%
echo.
set "SERVER_HOST=%HOST%"
set "NODE_ENV=production"
call pnpm start
exit /b %errorlevel%
