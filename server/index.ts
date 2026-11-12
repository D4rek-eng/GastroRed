import { app } from './app.js'
import { config } from './config.js'
import { getPool } from './db.js'

async function start() {
  await getPool().query('SELECT 1 FROM users LIMIT 0')
  const server = app.listen(config.API_PORT, config.API_HOST, () => {
    console.info(`GastroRed API listening on ${config.API_HOST}:${config.API_PORT}`)
  })

  const shutdown = () => {
    server.close(() => {
      void getPool().end().then(() => process.exit(0))
    })
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

start().catch((error: unknown) => {
  console.error('Could not start GastroRed API', error)
  process.exitCode = 1
})
