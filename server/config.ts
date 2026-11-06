import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({ path: process.env.SERVER_ENV_FILE ?? '.env.server' })

const optionalUrl = z.string().url().optional().or(z.literal(''))
const environment = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173/GastroRed/'),
  MYSQL_HOST: z.string().min(1).default('127.0.0.1'),
  MYSQL_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  MYSQL_USER: z.string().min(1).default('gastrored'),
  MYSQL_PASSWORD: z.string().default(''),
  MYSQL_DATABASE: z.string().regex(/^[A-Za-z0-9_]+$/).default('gastrored'),
  SESSION_SECRET: z.string().default('development-only-session-secret-change-me'),
  SMTP_URL: optionalUrl.default(''),
  EMAIL_FROM: z.string().min(1).default('GastroRed <no-reply@example.com>'),
  MERCADOPAGO_ACCESS_TOKEN: z.string().default(''),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().default(''),
  MERCADOPAGO_WEBHOOK_URL: optionalUrl.default(''),
  DEMO_PAYMENTS_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
}).parse(process.env)

if (
  environment.NODE_ENV === 'production' &&
  (environment.SESSION_SECRET.length < 32 || environment.SESSION_SECRET === 'development-only-session-secret-change-me')
) {
  throw new Error('Configura un SESSION_SECRET aleatorio de al menos 32 caracteres en producción.')
}

if (environment.NODE_ENV === 'production' && environment.DEMO_PAYMENTS_ENABLED) {
  throw new Error('DEMO_PAYMENTS_ENABLED no puede activarse en producción.')
}

export const config = {
  ...environment,
  sessionCookieName: 'gastro_session',
  sessionLifetimeDays: 30,
  customerProAmount: 100,
  restaurantAmount: 120,
  isProduction: environment.NODE_ENV === 'production',
}
