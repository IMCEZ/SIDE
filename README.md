# SIDE

SIDE 是一个面向本地使用场景的全栈 AI 对话项目，前端基于 React 18 + Vite，后端基于 Express + TypeScript，数据默认保存在本地 `server/data` 中。仓库采用 pnpm workspace 组织，提供 Windows、Linux 和 Termux 三套启动方式，适合本地开发、打包构建与自托管运行。

## 技术栈

- 前端：React 18、TypeScript、Vite、Tailwind CSS、TanStack Query、Zustand
- 后端：Express、TypeScript、sql.js
- 数据：SQLite 风格本地单文件持久化（`server/data/side.db`）
- 工程化：pnpm workspace、Vitest、ESLint

## 目录结构

```text
SIDE/
├─ client/                 # Vite + React 前端
├─ server/                 # Express + TypeScript 后端
│  ├─ data/                # 运行时数据目录，仅保留 .gitkeep
│  └─ src/                 # 服务端源码
├─ scripts/                # Windows / Linux / Termux 启动脚本
├─ .github/                # GitHub 模板与仓库元数据
├─ package.json            # 根工作区脚本
├─ pnpm-workspace.yaml     # workspace 定义
└─ README.md               # 项目说明
```

## 环境要求

- Node.js 18 及以上
- pnpm 8 及以上
- 首次运行前建议确认以下命令可用：

```bash
node -v
pnpm -v
```

如果没有安装 pnpm，仓库脚本会优先尝试使用 `corepack`，其次尝试使用 `npm install -g pnpm`。

## 快速开始

### 1. 克隆仓库

```bash
git clone <你的仓库地址>
cd SIDE
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 初始化环境变量

首次运行前，将示例文件复制为真实配置：

```bash
cp server/.env.example server/.env
```

Windows 可直接执行：

```powershell
copy server\.env.example server\.env
```

默认配置如下：

- `JWT_SECRET`：必须修改为随机字符串
- `PORT`：后端端口，默认 `3000`
- `SERVER_HOST`：后端监听地址，默认 `127.0.0.1`
- `CLIENT_DEV_PORT`：前端开发端口，默认 `5173`

### 4. 开发启动

```bash
pnpm dev
```

默认访问地址：

- 前端开发环境：`http://127.0.0.1:5173`
- 后端接口：`http://127.0.0.1:3000`

## 根目录脚本说明

根目录 `package.json` 统一提供以下脚本：

```bash
pnpm dev         # 同时启动 client 与 server 开发模式
pnpm build       # 构建 client/dist 与 server/dist
pnpm start       # 启动生产模式 server，自动托管 client/dist
pnpm test        # 运行 server 测试
pnpm lint        # 运行 client ESLint
pnpm typecheck   # 运行 client + server TypeScript 检查
```

生产模式下，后端会自动静态托管 `client/dist`，因此标准流程是：

```bash
pnpm build
pnpm start
```

## Windows 启动

项目提供 [start.bat](file:///c:/Users/24165/Desktop/SIDE/scripts/start.bat) 统一入口。

### 开发模式

双击 `scripts/start.bat`，或在 PowerShell 中执行：

```powershell
.\scripts\start.bat dev
```

### 构建模式

```powershell
.\scripts\start.bat build
```

### 运行生产模式

```powershell
.\scripts\start.bat start
```

脚本会自动完成以下事项：

- 检查 Node.js
- 检查 pnpm，并尝试自动安装
- 首次运行时自动执行 `pnpm install`
- 自动创建 `server/data`
- 如果缺少 `server/.env`，自动由 `server/.env.example` 复制生成

如需修改端口，可先设置环境变量再执行：

```powershell
$env:HOST="0.0.0.0"
$env:PORT="3001"
$env:CLIENT_PORT="5174"
.\scripts\start.bat dev
```

## Linux 启动

项目提供 [start.sh](file:///c:/Users/24165/Desktop/SIDE/scripts/start.sh) 统一入口。

首次使用建议赋予执行权限：

```bash
chmod +x scripts/start.sh
```

### 开发模式

```bash
bash scripts/start.sh dev
```

### 构建模式

```bash
bash scripts/start.sh build
```

### 运行生产模式

```bash
bash scripts/start.sh start
```

如需局域网访问，可使用：

```bash
HOST=0.0.0.0 PORT=3000 CLIENT_PORT=5173 bash scripts/start.sh dev
```

## Termux 启动

项目提供 [start-termux.sh](file:///c:/Users/24165/Desktop/SIDE/scripts/start-termux.sh) 统一入口，目标覆盖开发、构建、运行三种场景。

### 环境准备

建议先执行：

```bash
pkg update -y
pkg install -y git nodejs-lts
termux-setup-storage
```

说明：

- `termux-setup-storage` 用于授权访问共享存储
- 建议将项目放在 Termux 可稳定访问的目录中，避免直接在受限目录运行
- 首次运行脚本时，会自动尝试准备 `pnpm`

### 开发模式

```bash
bash scripts/start-termux.sh dev
```

默认行为：

- 前端 Vite 监听 `0.0.0.0:5173`
- 后端监听 `0.0.0.0:3000`
- 本机浏览器优先访问 `http://127.0.0.1:5173`
- 若手机与其他设备在同一局域网，可使用 `http://<手机局域网IP>:5173` 访问前端

### 构建模式

```bash
bash scripts/start-termux.sh build
```

生成产物：

- `client/dist`
- `server/dist`

### 运行模式

```bash
bash scripts/start-termux.sh start
```

此模式要求已经完成构建。启动后访问：

- 本机浏览器：`http://127.0.0.1:3000`
- 局域网设备：`http://<手机局域网IP>:3000`

### Termux 注意事项

- 某些 Android 设备会对后台进程做限制，长时间运行服务时可能被系统回收
- 若端口无法访问，先确认 Termux 没有被系统休眠
- 若需要外部设备访问，请确保手机和访问设备在同一 Wi‑Fi，并且防火墙或系统策略没有拦截
- 若你只在手机本机使用，优先使用 `127.0.0.1` 访问，最稳定

## 构建与运行

### 构建

```bash
pnpm build
```

构建后：

- 前端静态资源输出到 `client/dist`
- 后端编译结果输出到 `server/dist`

### 运行生产模式

```bash
pnpm start
```

此时后端会托管前端构建产物，因此只需访问一个地址：

- `http://127.0.0.1:3000`

## 数据目录说明

运行时数据位于 `server/data`：

| 路径 | 用途 | 是否入库 |
| --- | --- | --- |
| `server/data/.gitkeep` | 保留空目录结构 | 是 |
| `server/data/side.db` | 本地数据库文件 | 否 |
| `server/data/characters/` | 角色相关本地文件 | 否 |
| `server/data/worlds/` | 世界书本地文件 | 否 |
| `server/data/presets/` | 预设本地文件 | 否 |

这意味着仓库只保留目录骨架，不提交用户数据、导入资源和数据库文件。备份时建议直接复制整个 `server/data/` 目录。

## 仓库整理说明

当前仓库治理遵循以下原则：

- `node_modules/`、构建产物、日志、IDE 缓存不入库
- `.vs/`、`.vscode/`、便携 Node 目录属于本地环境残留，不应提交
- `server/data` 只保留 `.gitkeep`，避免把个人数据提交到仓库
- README、脚本与实际端口、目录、运行链路保持一致

## 常见问题

### 1. 启动时报 JWT_SECRET 未配置

请确认已创建 `server/.env`，并将 `JWT_SECRET` 改成至少 8 位的随机字符串。

### 2. 访问不到页面

开发模式下请先确认两个进程都已启动：

- 前端：`5173`
- 后端：`3000`

如果你修改了端口，请按新的端口访问。

### 3. 端口被占用

可通过环境变量切换端口，例如：

```bash
PORT=3001 CLIENT_PORT=5174 bash scripts/start.sh dev
```

Windows：

```powershell
$env:PORT="3001"
$env:CLIENT_PORT="5174"
.\scripts\start.bat dev
```

### 4. Termux 可以本机访问但局域网不通

优先检查：

- 是否使用了 `HOST=0.0.0.0`
- 手机与访问设备是否在同一局域网
- Android 是否限制了 Termux 后台运行
- 路由器或系统策略是否拦截目标端口

## 注意事项

- 本项目默认面向本地或可信网络环境运行
- 不建议把 `server/.env`、数据库文件或导入资源提交到 Git 仓库
- 如果你修改了启动脚本、端口或目录策略，请同步更新 README，避免文档与仓库事实脱节
