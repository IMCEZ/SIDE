import app from './app';
import 'dotenv/config'
import { getDb, initDatabase } from './db'
import { initDefaultUser } from './routes/auth'

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret || jwtSecret.length < 8) {
  console.error('\n❌ 启动失败：JWT_SECRET 未正确配置')
  console.error('请复制 server/.env.example 为 server/.env，并将 JWT_SECRET 改成至少 8 位的随机字符串\n')
  process.exit(1)
}

const PORT = Number(process.env.PORT) || 3000
const HOST = process.env.SERVER_HOST || '127.0.0.1'
const clientDevPort = Number(process.env.CLIENT_DEV_PORT) || 5173
const isProduction = process.env.NODE_ENV === 'production'

async function bootstrap() {
  await getDb()
  await initDatabase()
  await initDefaultUser()

  const server = app.listen(PORT, HOST, () => {
    console.log(`\n✅ SIDE 后端已启动`)
    console.log(`   后端：http://${HOST}:${PORT}`)
    if (isProduction) {
      console.log(`   前端：http://${HOST}:${PORT}`)
    } else {
      console.log(`   前端开发地址：http://${HOST}:${clientDevPort}`)
    }
    console.log('')
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ 端口 ${PORT} 已被占用。请结束占用该端口的进程，或在环境变量 PORT 中指定其他端口。\n`)
    } else if (err.code === 'EACCES') {
      console.error(`\n❌ 无权限监听 ${HOST}:${PORT}。请更换端口或检查系统权限。\n`)
    } else {
      console.error('\n❌ HTTP 监听失败:', err)
    }
    process.exit(1)
  })
}

bootstrap().catch((err) => {
  console.error('启动失败:', err)
  process.exit(1)
})
