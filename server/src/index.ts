import fs from 'fs';
import path from 'path';
import app from './app';
import { initializeSchema } from './db';

// 环境变量安全校验
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret || jwtSecret === '请替换为随机字符串' || jwtSecret.length < 16) {
  console.error('\n❌ 启动失败：JWT_SECRET 未正确配置')
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.error('请按以下步骤操作：')
  console.error('  1. 找到 server/.env.example 文件')
  console.error('  2. 复制一份，命名为 server/.env')
  console.error('  3. 将 JWT_SECRET 替换为任意随机字符串')
  console.error('  4. 重新启动 SIDE')
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  process.exit(1)
}

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=');
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnv();
initializeSchema();

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`SIDE server listening on http://localhost:${port}`);
});

