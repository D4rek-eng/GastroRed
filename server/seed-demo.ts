import { config } from './config.js'
import { getPool } from './db.js'
import { hashPassword } from './security.js'
import type { RowDataPacket } from 'mysql2'

const demoAccounts = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'cliente@gastrored.demo',
    name: 'Cliente de demostración',
    password: 'GastroDemo2026!',
    role: 'customer',
    plan: 'free',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'propietario@mesaysabor.demo',
    name: 'Mesa y Sabor (Demo)',
    password: 'MesaDemo2026!',
    role: 'restaurant',
    plan: 'restaurant',
    domain: 'mesaysabor.demo',
    restaurantId: 'central',
  },
] as const

if (config.isProduction) {
  throw new Error('No se pueden crear cuentas demo en producción.')
}

const pool = getPool()

try {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    for (const account of demoAccounts) {
      const [existingUsers] = await connection.execute<RowDataPacket[]>(
        'SELECT id, email FROM users WHERE id = ? OR email = ? FOR UPDATE',
        [account.id, account.email],
      )
      if (existingUsers.some((user) => user.id !== account.id || user.email !== account.email)) {
        throw new Error(`No se puede crear ${account.email}: el correo o ID ya pertenece a otra cuenta.`)
      }

      const passwordHash = await hashPassword(account.password)
      await connection.execute(
        `INSERT INTO users (id, email, display_name, password_hash, role, plan, plan_status, email_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           password_hash = VALUES(password_hash),
           plan = VALUES(plan),
           plan_status = 'active',
           email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP())`,
        [account.id, account.email, account.name, passwordHash, account.role, account.plan],
      )

      if (account.role === 'restaurant') {
        await connection.execute(
          `INSERT INTO restaurant_accounts (user_id, business_name, domain, restaurant_id)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             business_name = VALUES(business_name),
             domain = VALUES(domain),
             restaurant_id = VALUES(restaurant_id)`,
          [account.id, account.name, account.domain, account.restaurantId],
        )
        await connection.execute(
          `INSERT IGNORE INTO restaurant_settings
             (restaurant_id, hours, available_times, table_availability, reservation_policy, price_per_person, menu_highlights)
           VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            account.restaurantId,
            'Lun-Dom · 12:00–22:00',
            JSON.stringify(['12:00', '13:00', '14:00', '19:00', '20:00', '21:00']),
            JSON.stringify({ '12:00': 8, '13:00': 8, '14:00': 8, '19:00': 8, '20:00': 8, '21:00': 8 }),
            'Reserva de demostración: llega a tiempo y confirma los cambios directamente con el restaurante.',
            85,
            JSON.stringify([
              { name: 'Menú de temporada', description: 'Selección de la casa para la demostración.', price: 85 },
            ]),
          ],
        )
      }
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  console.info('Cuentas de demostración listas:')
  console.info('Cliente: cliente@gastrored.demo / GastroDemo2026!')
  console.info('Restaurante (dominio): mesaysabor.demo / MesaDemo2026!')
} catch (error) {
  console.error('No se pudieron crear las cuentas de demostración.', error)
  process.exitCode = 1
} finally {
  await pool.end()
}
