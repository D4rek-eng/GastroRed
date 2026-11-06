import { initializeDatabase } from './app.js'
import { getPool } from './db.js'

try {
  await initializeDatabase()
  console.info('GastroRed database migrations completed.')
} catch (error) {
  console.error('Database migration failed', error)
  process.exitCode = 1
} finally {
  await getPool().end()
}
