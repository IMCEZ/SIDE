<div align="center">

# SIDE

**沉浸式 AI 对话前端**

兼容 SillyTavern 数据格式 · 现代化界面 · 三端支持

</div>

---

## 平台支持

- Windows（双击 `start.bat` 启动）
- Linux（执行 `bash scripts/start.sh` 启动）
- Android（Termux + PWA 安装到桌面）

## 快速开始

### 1. 克隆仓库

git clone https://github.com/你的用户名/SIDE.git
cd SIDE

### 2. 配置环境变量

cp server/.env.example server/.env

用任意文本编辑器打开 `server/.env`，将 `JWT_SECRET` 替换为任意一段随机字符串。

### 3. 启动 SIDE

**Windows：**
双击 `start.bat`

**Linux：**
bash scripts/start.sh

**Android（Termux）：**
bash scripts/start-termux.sh

### 4. 访问

浏览器打开 http://localhost:5173，首次进入设置登录密码即可使用。

---

## 数据存储位置

所有数据均存储在本地：

| 路径 | 内容 |
|------|------|
| `server/data/side.db` | 对话记录、设置（最重要） |
| `server/data/characters/` | 角色卡头像 |
| `server/data/worlds/` | 世界书文件 |
| `server/data/presets/` | 预设文件 |

**备份方法**：定期复制 `server/data/` 整个文件夹即可。

---

## 兼容性

SIDE 兼容以下 SillyTavern 格式：
- 角色卡（PNG 嵌入式 + JSON）
- 世界书（JSON）
- 预设（JSON）

---

## 技术栈

- 前端：React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion
- 后端：Node.js + Express + TypeScript
- 数据库：SQLite（本地单文件）
- PWA：支持安装到桌面

## SIDE 项目说明

SIDE 是一个基于 Vite 的前端应用和 Node.js/TypeScript 后端组成的全栈项目，使用 pnpm 作为包管理工具。

---

## 环境要求

- **Node.js**: 推荐使用 **18 及以上版本**
  - 可在 Node.js 官网下载安装包：`https://nodejs.org`
  - 安装完成后，在终端中运行 `node -v` 确认版本号。
- **pnpm**: 作为包管理工具
  - 如果已安装 npm（随 Node.js 一起安装），可以通过以下命令全局安装 pnpm：
    - `npm install -g pnpm`
  - 安装完成后，在终端中运行 `pnpm -v` 确认安装成功。

---

## 首次启动步骤

以下步骤均在项目根目录（包含 `client/`、`server/`、`scripts/` 等子目录的 `SIDE/` 目录）执行。

### 方式一：通过命令行启动

1. **安装依赖**
   - 在终端中进入项目根目录：
     - 例如：`cd path/to/SIDE`
   - 执行：
     - `pnpm install`
   - 该命令会在项目根目录创建并安装所有依赖到 `node_modules/`。

2. **启动开发环境**
   - 仍然在项目根目录执行：
     - `pnpm dev`
   - 启动成功后，前端通常会运行在 `http://localhost:5173`（如有修改，以实际配置为准）。

### 方式二：通过 Windows 启动脚本启动

1. 确保已经安装好 **Node.js** 和 **pnpm**（见上方环境要求）。
2. 在 Windows 资源管理器中打开项目根目录 `SIDE/`。
3. 进入 `scripts/` 子目录。
4. 双击运行：
   - `start.bat`
5. 脚本会自动完成以下操作：
   - 检查 Node.js 是否安装；
   - 检查 pnpm 是否安装，必要时尝试通过 `npm install -g pnpm` 安装；
   - 检查并安装项目依赖（在项目根目录执行 `pnpm install`，若 `node_modules/` 不存在）；
   - 启动开发环境（等价于在项目根执行 `pnpm dev`）；
   - 在默认浏览器中打开 `http://localhost:5173`。

如果脚本执行过程中出现错误，命令行窗口会停留在错误信息界面，方便你查看和排查问题。

---

## 常见问题与排查

### 1. 未安装 Node.js 或版本过低

- **现象**：
  - 运行 `start.bat` 时提示未检测到 Node.js；
  - 或在终端运行 `node -v` 时报错，或显示版本号低于 18。
- **解决方法**：
  - 前往 Node.js 官网：`https://nodejs.org` 下载并安装当前 LTS 或 18+ 版本；
  - 安装完成后，重新打开终端或重新运行 `start.bat`。

### 2. 未安装 pnpm

- **现象**：
  - 在终端中运行 `pnpm -v` 提示命令不存在；
  - 运行 `start.bat` 时，脚本会尝试通过 `npm install -g pnpm` 安装 pnpm，如安装失败会在窗口中提示错误。
- **解决方法**：
  - 确保已安装 npm（随 Node.js 一起安装）；
  - 在终端中执行：
    - `npm install -g pnpm`
  - 安装完成后重新运行：
    - 命令行方式：`pnpm install`、`pnpm dev`
    - 或再次双击 `scripts/start.bat`。

### 3. 端口被占用（例如 5173）

- **现象**：
  - 启动 dev 环境时终端报错，提示端口 `5173` 已被占用；
  - 或浏览器访问 `http://localhost:5173` 时无法正常打开当前项目。
- **排查步骤**：
  - 检查是否已有其他 Vite 或前端项目占用了该端口；
  - 关闭可能占用端口的其他开发服务（例如其他项目的 `npm run dev` / `pnpm dev` 进程）。
- **解决方法**：
  - 关闭占用端口的进程后，重新运行：
    - `pnpm dev`，或
    - 双击 `scripts/start.bat`。
  - 如需修改 Vite 默认端口，可在前端配置中调整端口，并相应更新访问地址。

---

## 其他说明

- 推荐在开发过程中始终在项目根目录执行与依赖、启动相关的命令（如 `pnpm install`、`pnpm dev`），以避免路径混乱。
- 如果对项目结构或脚本行为有修改，请在更新后同步维护本说明文档，方便其他开发者快速上手。
