import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { config } from './config.js'
import { getPool } from './db.js'
import {
  hashPassword,
  hashSessionToken,
  hashVerificationCode,
  isBusinessEmailForDomain,
  newSessionToken,
  newVerificationCode,
  normalizeDomain,
  normalizeEmail,
  secureEquals,
  verifyHmacSignature,
  verifyPassword,
} from './security.js'
import type { RowDataPacket } from 'mysql2'

type AccountRole = 'customer' | 'restaurant'
type AccountPlan = 'free' | 'pro' | 'restaurant'
type PlanStatus = 'active' | 'pending_payment' | 'cancelled'

type AccountSession = {
  id: string
  email: string
  name: string
  role: AccountRole
  plan: AccountPlan
  planStatus: PlanStatus
  domain?: string
  restaurantIds: string[]
}

type AccountRecord = AccountSession & {
  passwordHash: string
  emailVerifiedAt: string | null
}

declare global {
  namespace Express {
    interface Request {
      account?: AccountRecord
      sessionToken?: string
    }
  }
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

const pool = getPool()
const app = express()
const emailTransport = config.SMTP_URL
  ? nodemailer.createTransport(config.SMTP_URL)
  : null
const authRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.' },
})

const customerRegistration = z.object({
  role: z.literal('customer'),
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  password: z.string().min(10).max(128),
  plan: z.enum(['free', 'pro']),
})

const restaurantRegistration = z.object({
  role: z.literal('restaurant'),
  name: z.string().trim().min(2).max(160),
  email: z.email().max(254),
  password: z.string().min(10).max(128),
  plan: z.literal('restaurant'),
  domain: z.string().min(3).max(253),
})

const reservationSchema = z.object({
  restaurantId: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9._:-]+$/),
  date: z.iso.date(),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  guests: z.number().int().min(1).max(12),
})

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(1000),
})

const restaurantSettingsSchema = z.object({
  hours: z.string().trim().min(1).max(120),
  availableTimes: z.array(z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)).min(1).max(30),
  reservationPolicy: z.string().trim().max(240),
  pricePerPerson: z.number().min(0).max(5000),
  menuHighlights: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500),
    price: z.number().min(0).max(5000),
    image: z.string().max(500).optional(),
  })).max(30),
})

const publicSettingsSchema = z.object({
  hours: z.string(),
  availableTimes: z.array(z.string()),
  reservationPolicy: z.string(),
  pricePerPerson: z.number(),
  menuHighlights: restaurantSettingsSchema.shape.menuHighlights,
})

function settingsFromRow(row: RowDataPacket) {
  const parsedMenu = row.menuHighlights
    ? typeof row.menuHighlights === 'string' ? JSON.parse(row.menuHighlights) : row.menuHighlights
    : undefined
  const parsed = publicSettingsSchema.partial().safeParse({
    ...(row.hours !== null && row.hours !== undefined ? { hours: row.hours } : {}),
    ...(row.availableTimes !== null && row.availableTimes !== undefined ? { availableTimes: typeof row.availableTimes === 'string' ? JSON.parse(row.availableTimes) : row.availableTimes } : {}),
    ...(row.reservationPolicy !== null && row.reservationPolicy !== undefined ? { reservationPolicy: row.reservationPolicy } : {}),
    ...(row.pricePerPerson !== null && row.pricePerPerson !== undefined ? { pricePerPerson: Number(row.pricePerPerson) } : {}),
    ...(parsedMenu ? { menuHighlights: parsedMenu } : {}),
  })
  if (!parsed.success) throw new Error('Restaurant settings in the database are invalid.')
  return parsed.data
}

type UserRow = RowDataPacket & {
  id: string
  email: string
  display_name: string
  password_hash: string
  role: AccountRole
  plan: AccountPlan
  plan_status: PlanStatus
  email_verified_at: string | null
  domain: string | null
  restaurant_id: string | null
}

type VerificationRow = RowDataPacket & {
  code_hash: string
  expires_at: string
  attempts: number
  id: string
}

function accountFromRow(row: UserRow): AccountRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.display_name,
    role: row.role,
    plan: row.plan,
    planStatus: row.plan_status,
    ...(row.domain ? { domain: row.domain } : {}),
    restaurantIds: row.restaurant_id ? [row.restaurant_id] : [],
    passwordHash: row.password_hash,
    emailVerifiedAt: row.email_verified_at,
  }
}

function publicSession(account: AccountRecord): AccountSession {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
    plan: account.plan,
    planStatus: account.planStatus,
    ...(account.domain ? { domain: account.domain } : {}),
    restaurantIds: account.restaurantIds,
  }
}

function setSessionCookie(response: Response, token: string) {
  const maxAge = config.sessionLifetimeDays * 24 * 60 * 60
  response.cookie(config.sessionCookieName, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAge * 1000,
  })
}

function clearSessionCookie(response: Response) {
  response.clearCookie(config.sessionCookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
  })
}

async function createSession(response: Response, account: AccountRecord) {
  const token = newSessionToken()
  const expiresAt = new Date(Date.now() + config.sessionLifetimeDays * 24 * 60 * 60 * 1000)
  await pool.execute('DELETE FROM user_sessions WHERE expires_at <= UTC_TIMESTAMP()')
  await pool.execute(
    'INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [hashSessionToken(token), account.id, expiresAt],
  )
  setSessionCookie(response, token)
}

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.cookie
  if (!cookieHeader) return undefined
  const prefix = `${name}=`
  const value = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))
  return value ? decodeURIComponent(value.slice(prefix.length)) : undefined
}

async function requireAuth(request: Request, _response: Response, next: NextFunction) {
  try {
    const token = readCookie(request, config.sessionCookieName)
    if (!token) throw new HttpError(401, 'Inicia sesión para continuar.')
    const [rows] = await pool.execute<UserRow[]>(
      `SELECT u.id, u.email, u.display_name, u.password_hash, u.role, u.plan, u.plan_status,
              u.email_verified_at, ra.domain, ra.restaurant_id
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN restaurant_accounts ra ON ra.user_id = u.id
       WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()
       LIMIT 1`,
      [hashSessionToken(token)],
    )
    if (!rows.length) throw new HttpError(401, 'Tu sesión venció. Inicia sesión nuevamente.')
    const account = accountFromRow(rows[0])
    if (!account.emailVerifiedAt) throw new HttpError(403, 'Verifica tu correo para continuar.')
    request.account = account
    request.sessionToken = token
    next()
  } catch (error) {
    next(error)
  }
}

function requireRole(...roles: AccountRole[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.account || !roles.includes(request.account.role)) {
      next(new HttpError(403, 'Tu cuenta no tiene acceso a esta operación.'))
      return
    }
    next()
  }
}

function requireActiveRestaurant(request: Request, _response: Response, next: NextFunction) {
  if (!request.account || request.account.role !== 'restaurant' || request.account.planStatus !== 'active') {
    next(new HttpError(403, 'El portal para restaurantes requiere una suscripción activa.'))
    return
  }
  next()
}

async function issueVerificationCode(userId: string): Promise<string> {
  const code = newVerificationCode()
  const expiresAt = new Date(Date.now() + 15 * 60_000)
  await pool.execute(
    `INSERT INTO email_verification_codes (user_id, code_hash, expires_at, attempts)
     VALUES (?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at), attempts = 0`,
    [userId, hashVerificationCode(code), expiresAt],
  )
  return code
}

async function sendVerificationEmail(email: string, code: string): Promise<void> {
  if (!emailTransport) {
    if (config.isProduction) throw new HttpError(503, 'El envío de correo no está configurado. Contacta al administrador.')
    return
  }
  await emailTransport.sendMail({
    from: config.EMAIL_FROM,
    to: email,
    subject: 'Verifica tu correo de GastroRed',
    text: `Tu código de verificación es ${code}. Vence en 15 minutos.`,
  })
}

async function findAccountByLogin(role: AccountRole, identifier: string): Promise<AccountRecord | null> {
  const [rows] = role === 'customer'
    ? await pool.execute<UserRow[]>(
        `SELECT u.id, u.email, u.display_name, u.password_hash, u.role, u.plan, u.plan_status,
                u.email_verified_at, ra.domain, ra.restaurant_id
         FROM users u LEFT JOIN restaurant_accounts ra ON ra.user_id = u.id
         WHERE u.role = 'customer' AND u.email = ? LIMIT 1`,
        [normalizeEmail(identifier)],
      )
    : await pool.execute<UserRow[]>(
        `SELECT u.id, u.email, u.display_name, u.password_hash, u.role, u.plan, u.plan_status,
                u.email_verified_at, ra.domain, ra.restaurant_id
         FROM users u JOIN restaurant_accounts ra ON ra.user_id = u.id
         WHERE u.role = 'restaurant' AND ra.domain = ? LIMIT 1`,
        [normalizeDomain(identifier.includes('@') ? identifier.split('@').at(-1) ?? '' : identifier)],
      )
  return rows.length ? accountFromRow(rows[0]) : null
}

function validateOrigin(request: Request, _response: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method) || request.path === '/api/v1/billing/webhook') {
    next()
    return
  }
  const origin = request.get('origin')
  if (!origin) {
    next()
    return
  }
  const allowedOrigins = new Set(config.isProduction
    ? [config.FRONTEND_ORIGIN]
    : [config.FRONTEND_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'])
  if (!allowedOrigins.has(origin)) {
    next(new HttpError(403, 'Origen no permitido.'))
    return
  }
  next()
}

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({
  origin: config.isProduction
    ? config.FRONTEND_ORIGIN
    : [config.FRONTEND_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}))
app.use(express.json({ limit: '32kb' }))
app.use(validateOrigin)

app.get('/health', async (_request, response) => {
  await pool.query('SELECT 1')
  response.json({ status: 'ok' })
})

app.post('/api/v1/auth/register', authRateLimit, async (request, response) => {
  const role = request.body?.role
  const parsed = role === 'customer'
    ? customerRegistration.safeParse(request.body)
    : restaurantRegistration.safeParse(request.body)
  if (!parsed.success) throw new HttpError(400, 'Revisa los datos del formulario e inténtalo nuevamente.')

  const data = parsed.data
  const email = normalizeEmail(data.email)
  const domain = data.role === 'restaurant' ? normalizeDomain(data.domain) : undefined
  if (data.role === 'restaurant') {
    if (!domain || !isBusinessEmailForDomain(email, domain)) {
      throw new HttpError(400, 'El correo corporativo debe pertenecer al dominio de la empresa.')
    }
  }
  if (config.isProduction && !emailTransport) {
    throw new HttpError(503, 'El envío de correo no está configurado. Contacta al administrador.')
  }

  const id = randomUUID()
  const passwordHash = await hashPassword(data.password)
  const plan: AccountPlan = data.role === 'restaurant' ? 'restaurant' : data.plan
  const planStatus: PlanStatus = data.role === 'customer' && data.plan === 'free' ? 'active' : 'pending_payment'
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute(
      'INSERT INTO users (id, email, display_name, password_hash, role, plan, plan_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, email, data.name, passwordHash, data.role, plan, planStatus],
    )
    if (data.role === 'restaurant' && domain) {
      await connection.execute(
        'INSERT INTO restaurant_accounts (user_id, business_name, domain) VALUES (?, ?, ?)',
        [id, data.name, domain],
      )
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'Ese correo o dominio ya está registrado.')
    }
    throw error
  } finally {
    connection.release()
  }

  const code = await issueVerificationCode(id)
  await sendVerificationEmail(email, code)
  response.status(201).json({
    email,
    ...(config.isProduction ? {} : { verificationCode: code }),
    message: 'Cuenta creada. Verifica tu correo para iniciar sesión.',
  })
})

app.post('/api/v1/auth/verify-email', authRateLimit, async (request, response) => {
  const input = z.object({ email: z.email().max(254), code: z.string().regex(/^\d{6}$/) }).safeParse(request.body)
  if (!input.success) throw new HttpError(400, 'Ingresa el correo y el código de seis dígitos.')
  const [rows] = await pool.execute<VerificationRow[]>(
    `SELECT v.code_hash, v.expires_at, v.attempts, u.id
     FROM email_verification_codes v JOIN users u ON u.id = v.user_id
     WHERE u.email = ? LIMIT 1`,
    [normalizeEmail(input.data.email)],
  )
  const verification = rows[0]
  if (!verification || new Date(verification.expires_at).getTime() <= Date.now() || verification.attempts >= 5) {
    throw new HttpError(400, 'El código venció o ya no es válido. Solicita uno nuevo.')
  }
  if (!secureEquals(hashVerificationCode(input.data.code), verification.code_hash)) {
    await pool.execute('UPDATE email_verification_codes SET attempts = attempts + 1 WHERE user_id = ?', [verification.id])
    throw new HttpError(400, 'El código no coincide. Revisa el mensaje que enviamos a tu correo.')
  }
  await pool.execute(
    'UPDATE users SET email_verified_at = UTC_TIMESTAMP() WHERE id = ?',
    [verification.id],
  )
  await pool.execute('DELETE FROM email_verification_codes WHERE user_id = ?', [verification.id])
  const account = await findAccountById(verification.id)
  if (!account) throw new HttpError(404, 'No encontramos esa cuenta.')
  await createSession(response, account)
  response.json(publicSession(account))
})

app.post('/api/v1/auth/resend-verification', authRateLimit, async (request, response) => {
  const input = z.object({ email: z.email().max(254) }).safeParse(request.body)
  if (!input.success) throw new HttpError(400, 'Escribe un correo válido.')
  const email = normalizeEmail(input.data.email)
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, email_verified_at FROM users WHERE email = ? LIMIT 1',
    [email],
  )
  const account = rows[0] as { id: string; email_verified_at: string | null } | undefined
  if (!account || account.email_verified_at) {
    response.json({ message: 'Si la cuenta necesita verificación, enviaremos un nuevo código.' })
    return
  }
  const code = await issueVerificationCode(account.id)
  await sendVerificationEmail(email, code)
  response.json({
    message: 'Si la cuenta necesita verificación, enviaremos un nuevo código.',
    ...(config.isProduction ? {} : { verificationCode: code }),
  })
})

app.post('/api/v1/auth/login', authRateLimit, async (request, response) => {
  const input = z.object({
    role: z.enum(['customer', 'restaurant']),
    identifier: z.string().trim().min(1).max(254),
    password: z.string().min(1).max(128),
  }).safeParse(request.body)
  if (!input.success) throw new HttpError(400, 'Completa tu usuario y contraseña.')
  const account = await findAccountByLogin(input.data.role, input.data.identifier)
  if (!account || !(await verifyPassword(input.data.password, account.passwordHash))) {
    throw new HttpError(401, 'Usuario o contraseña incorrectos.')
  }
  if (!account.emailVerifiedAt) throw new HttpError(403, 'Verifica tu correo antes de iniciar sesión.')
  await createSession(response, account)
  response.json(publicSession(account))
})

app.post('/api/v1/auth/owner/login', authRateLimit, async (request, response) => {
  const input = z.object({ email: z.email().max(254), password: z.string().min(1).max(128) }).safeParse(request.body)
  if (!input.success) throw new HttpError(400, 'Completa tu correo y contraseña.')
  const account = await findAccountByLogin('restaurant', input.data.email)
  if (!account || !(await verifyPassword(input.data.password, account.passwordHash))) {
    throw new HttpError(401, 'Correo o contraseña incorrectos.')
  }
  if (!account.emailVerifiedAt) throw new HttpError(403, 'Verifica tu correo antes de iniciar sesión.')
  await createSession(response, account)
  response.json(publicSession(account))
})

app.get('/api/v1/auth/session', requireAuth, (request, response) => {
  response.json(publicSession(request.account!))
})

app.get('/api/v1/auth/owner/session', requireAuth, requireRole('restaurant'), (request, response) => {
  response.json(publicSession(request.account!))
})

app.post('/api/v1/auth/logout', requireAuth, async (request, response) => {
  await pool.execute('DELETE FROM user_sessions WHERE token_hash = ?', [hashSessionToken(request.sessionToken!)])
  clearSessionCookie(response)
  response.status(204).end()
})

app.post('/api/v1/auth/owner/logout', requireAuth, async (request, response) => {
  await pool.execute('DELETE FROM user_sessions WHERE token_hash = ?', [hashSessionToken(request.sessionToken!)])
  clearSessionCookie(response)
  response.status(204).end()
})

app.post('/api/v1/billing/checkout', requireAuth, async (request, response) => {
  const input = z.object({ plan: z.enum(['pro', 'restaurant']).optional() }).safeParse(request.body)
  if (!input.success) throw new HttpError(400, 'Plan de pago no válido.')
  const account = request.account!
  const plan = input.data.plan ?? (account.role === 'restaurant' ? 'restaurant' : account.plan === 'pro' ? 'pro' : undefined)
  if (!plan || (account.role === 'restaurant' && plan !== 'restaurant') || (account.role === 'customer' && plan !== 'pro')) {
    throw new HttpError(400, 'Ese plan no está disponible para tu tipo de cuenta.')
  }
  if (account.plan === plan && account.planStatus === 'active') {
    throw new HttpError(409, 'Tu suscripción ya está activa.')
  }
  if (!account.emailVerifiedAt) throw new HttpError(403, 'Verifica tu correo antes de pagar.')
  if (!config.MERCADOPAGO_ACCESS_TOKEN || !config.MERCADOPAGO_WEBHOOK_URL) {
    throw new HttpError(503, 'Mercado Pago no está configurado todavía. Contacta al administrador.')
  }

  const amount = plan === 'restaurant' ? config.restaurantAmount : config.customerProAmount
  const backUrl = new URL('perfil', config.FRONTEND_URL).toString()
  const checkoutResponse = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${config.MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reason: `GastroRed ${plan === 'restaurant' ? 'Restaurante' : 'Pro'} mensual`,
      external_reference: `${account.id}:${plan}`,
      payer_email: account.email,
      back_url: backUrl,
      notification_url: config.MERCADOPAGO_WEBHOOK_URL,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: amount,
        currency_id: 'PEN',
      },
    }),
  })
  if (!checkoutResponse.ok) {
    console.error('Mercado Pago checkout creation failed', checkoutResponse.status)
    throw new HttpError(502, 'Mercado Pago no pudo iniciar el pago. Inténtalo más tarde.')
  }
  const checkout = await checkoutResponse.json() as { id?: string; init_point?: string }
  if (!checkout.id || !checkout.init_point) {
    throw new HttpError(502, 'Mercado Pago devolvió una respuesta de pago incompleta.')
  }
  const checkoutUrl = new URL(checkout.init_point)
  if (
    checkoutUrl.protocol !== 'https:' ||
    !['mercadopago.com', 'mercadopago.com.pe', 'www.mercadopago.com', 'www.mercadopago.com.pe'].includes(checkoutUrl.hostname)
  ) {
    throw new HttpError(502, 'Mercado Pago devolvió un enlace de pago no válido.')
  }
  await pool.execute(
    `INSERT INTO subscriptions (id, user_id, plan, provider, provider_subscription_id, status, amount, checkout_url)
     VALUES (?, ?, ?, 'mercadopago', ?, 'pending', ?, ?)
     ON DUPLICATE KEY UPDATE status = 'pending', amount = VALUES(amount), checkout_url = VALUES(checkout_url)`,
    [randomUUID(), account.id, plan, checkout.id, amount, checkout.init_point],
  )
  response.json({ url: checkout.init_point })
})

app.post('/api/v1/billing/webhook', async (request, response) => {
  if (!config.MERCADOPAGO_WEBHOOK_SECRET || !config.MERCADOPAGO_ACCESS_TOKEN) {
    throw new HttpError(503, 'El webhook de pagos no está configurado.')
  }
  const dataId = String(request.body?.data?.id ?? request.query['data.id'] ?? '')
  const signature = request.get('x-signature') ?? ''
  const requestId = request.get('x-request-id') ?? ''
  const signatureParts = Object.fromEntries(signature.split(',').map((part) => {
    const [key, value] = part.trim().split('=')
    return [key, value]
  }))
  const timestamp = signatureParts.ts
  const signatureValue = signatureParts.v1
  if (!dataId || !timestamp || !signatureValue) throw new HttpError(400, 'Firma de pago incompleta.')
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`
  if (!verifyHmacSignature(manifest, signatureValue, config.MERCADOPAGO_WEBHOOK_SECRET)) {
    throw new HttpError(401, 'Firma de pago inválida.')
  }

  const providerResponse = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(dataId)}`, {
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${config.MERCADOPAGO_ACCESS_TOKEN}` },
  })
  if (!providerResponse.ok) throw new HttpError(502, 'No se pudo verificar el estado del pago.')
  const preapproval = await providerResponse.json() as {
    id?: string
    status?: string
    external_reference?: string
    payer_email?: string
    date_modified?: string
    auto_recurring?: { transaction_amount?: number; currency_id?: string }
  }
  const [userId, plan] = (preapproval.external_reference ?? '').split(':')
  if (!preapproval.id || !userId || !['pro', 'restaurant'].includes(plan ?? '')) {
    throw new HttpError(400, 'La suscripción no corresponde a una cuenta válida.')
  }
  const [subscriptions] = await pool.execute<RowDataPacket[]>(
    'SELECT user_id, plan, amount FROM subscriptions WHERE provider_subscription_id = ? LIMIT 1',
    [preapproval.id],
  )
  const subscription = subscriptions[0]
  const expectedAmount = plan === 'restaurant' ? config.restaurantAmount : config.customerProAmount
  if (
    !subscription ||
    subscription.user_id !== userId ||
    subscription.plan !== plan ||
    Number(subscription.amount) !== expectedAmount ||
    Number(preapproval.auto_recurring?.transaction_amount) !== expectedAmount ||
    preapproval.auto_recurring?.currency_id !== 'PEN'
  ) {
    throw new HttpError(400, 'Los datos de la suscripción no coinciden con la cuenta.')
  }
  const [accounts] = await pool.execute<RowDataPacket[]>(
    'SELECT role, email FROM users WHERE id = ? LIMIT 1',
    [userId],
  )
  const user = accounts[0] as { role: AccountRole; email: string } | undefined
  if (!user || (plan === 'restaurant' ? user.role !== 'restaurant' : user.role !== 'customer') || normalizeEmail(preapproval.payer_email ?? '') !== user.email) {
    throw new HttpError(400, 'El pagador no coincide con la cuenta.')
  }

  const statusMap: Record<string, 'authorized' | 'paused' | 'cancelled' | 'rejected' | 'pending'> = {
    authorized: 'authorized',
    paused: 'paused',
    cancelled: 'cancelled',
    rejected: 'rejected',
    pending: 'pending',
  }
  const subscriptionStatus = statusMap[preapproval.status ?? ''] ?? 'pending'
  const eventKey = `${preapproval.id}:${subscriptionStatus}:${preapproval.date_modified ?? ''}`.slice(0, 180)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute('INSERT IGNORE INTO payment_webhook_events (event_key) VALUES (?)', [eventKey])
    await connection.execute(
      'UPDATE subscriptions SET status = ? WHERE provider_subscription_id = ?',
      [subscriptionStatus, preapproval.id],
    )
    if (subscriptionStatus === 'authorized') {
      await connection.execute(
        'UPDATE users SET plan = ?, plan_status = ? WHERE id = ?',
        [plan, 'active', userId],
      )
    } else if (subscriptionStatus === 'cancelled' || subscriptionStatus === 'rejected' || subscriptionStatus === 'paused') {
      await connection.execute(
        `UPDATE users
         SET plan = IF(role = 'customer', 'free', 'restaurant'),
             plan_status = IF(role = 'customer', 'active', 'cancelled')
         WHERE id = ? AND plan = ?`,
        [userId, plan],
      )
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  response.status(200).json({ received: true })
})

app.get('/api/v1/reservations', requireAuth, requireRole('customer'), async (request, response) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT b.id, b.restaurant_id AS restaurantId, r.name AS restaurantName, r.image AS restaurantImage,
            DATE_FORMAT(b.reservation_date, '%Y-%m-%d') AS date,
            TIME_FORMAT(b.reservation_time, '%H:%i') AS time,
            b.guests, b.customer_name AS name, b.customer_email AS email, b.status
     FROM reservations b JOIN restaurants r ON r.id = b.restaurant_id
     WHERE b.user_id = ? ORDER BY b.reservation_date DESC, b.reservation_time DESC`,
    [request.account!.id],
  )
  response.json(rows)
})

app.get('/api/v1/owner/reservations', requireAuth, requireRole('restaurant'), requireActiveRestaurant, async (request, response) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT b.id, b.restaurant_id AS restaurantId, r.name AS restaurantName, r.image AS restaurantImage,
            DATE_FORMAT(b.reservation_date, '%Y-%m-%d') AS date,
            TIME_FORMAT(b.reservation_time, '%H:%i') AS time,
            b.guests, b.customer_name AS name, b.customer_email AS email, b.status
     FROM reservations b
     JOIN restaurants r ON r.id = b.restaurant_id
     JOIN restaurant_accounts ra ON ra.restaurant_id = b.restaurant_id
     WHERE ra.user_id = ?
     ORDER BY b.reservation_date ASC, b.reservation_time ASC`,
    [request.account!.id],
  )
  response.json(rows)
})

app.patch('/api/v1/owner/reservations/:id', requireAuth, requireRole('restaurant'), requireActiveRestaurant, async (request, response) => {
  const input = z.object({ status: z.enum(['confirmed', 'completed', 'cancelled']) }).safeParse(request.body)
  if (!input.success) throw new HttpError(400, 'Elige un estado válido para la reserva.')
  const reservationId = parseRestaurantId(request.params.id)
  const [result] = await pool.execute(
    `UPDATE reservations
     SET status = ?
     WHERE id = ?
       AND status IN ('pending', 'confirmed')
       AND restaurant_id IN (
         SELECT restaurant_id FROM restaurant_accounts WHERE user_id = ? AND restaurant_id IS NOT NULL
       )`,
    [input.data.status, reservationId, request.account!.id],
  )
  if (!('affectedRows' in result) || result.affectedRows !== 1) {
    throw new HttpError(404, 'La reserva no existe, ya fue cerrada o no pertenece a tu restaurante.')
  }
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT b.id, b.restaurant_id AS restaurantId, r.name AS restaurantName, r.image AS restaurantImage,
            DATE_FORMAT(b.reservation_date, '%Y-%m-%d') AS date,
            TIME_FORMAT(b.reservation_time, '%H:%i') AS time,
            b.guests, b.customer_name AS name, b.customer_email AS email, b.status
     FROM reservations b JOIN restaurants r ON r.id = b.restaurant_id
     WHERE b.id = ? LIMIT 1`,
    [reservationId],
  )
  response.json(rows[0])
})

app.post('/api/v1/reservations', requireAuth, requireRole('customer'), async (request, response) => {
  const parsed = reservationSchema.safeParse(request.body)
  if (!parsed.success) throw new HttpError(400, 'Revisa la fecha, hora y número de personas.')
  const today = new Date().toISOString().slice(0, 10)
  if (parsed.data.date < today) throw new HttpError(400, 'La fecha de reserva debe ser hoy o posterior.')
  const [restaurants] = await pool.execute<RowDataPacket[]>(
    'SELECT id, name, image FROM restaurants WHERE id = ? AND source = ? LIMIT 1',
    [parsed.data.restaurantId, 'catalog'],
  )
  if (!restaurants.length) throw new HttpError(404, 'Este restaurante no recibe reservas en GastroRed.')
  const [settings] = await pool.execute<RowDataPacket[]>(
    'SELECT available_times AS availableTimes FROM restaurant_settings WHERE restaurant_id = ? LIMIT 1',
    [parsed.data.restaurantId],
  )
  const availableTimes = settings[0]?.availableTimes
    ? typeof settings[0].availableTimes === 'string' ? JSON.parse(settings[0].availableTimes) as string[] : settings[0].availableTimes as string[]
    : []
  if (!availableTimes.length) throw new HttpError(409, 'El restaurante todavía no publica disponibilidad para reservas.')
  if (!availableTimes.includes(parsed.data.time)) throw new HttpError(409, 'Ese horario ya no está disponible. Elige otro turno.')
  const id = randomUUID()
  await pool.execute(
    `INSERT INTO reservations
      (id, user_id, restaurant_id, reservation_date, reservation_time, guests, customer_name, customer_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      request.account!.id,
      parsed.data.restaurantId,
      parsed.data.date,
      `${parsed.data.time}:00`,
      parsed.data.guests,
      request.account!.name,
      request.account!.email,
    ],
  )
  response.status(201).json({
    ...parsed.data,
    id,
    status: 'pending',
    name: request.account!.name,
    email: request.account!.email,
    restaurantName: (restaurants[0] as { name: string }).name,
    restaurantImage: (restaurants[0] as { image: string }).image,
  })
})

app.get('/api/v1/restaurants/settings', async (_request, response) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT restaurant_id AS id, hours, available_times AS availableTimes,
            reservation_policy AS reservationPolicy, price_per_person AS pricePerPerson,
            menu_highlights AS menuHighlights
     FROM restaurant_settings`,
  )
  response.json(rows.map((row) => ({ id: row.id, ...settingsFromRow(row) })))
})

app.get('/api/v1/restaurants/:id', async (request, response) => {
  const restaurantId = parseRestaurantId(request.params.id)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.id, s.hours, s.available_times AS availableTimes,
            s.reservation_policy AS reservationPolicy, s.price_per_person AS pricePerPerson,
            s.menu_highlights AS menuHighlights
     FROM restaurants r LEFT JOIN restaurant_settings s ON s.restaurant_id = r.id
     WHERE r.id = ? LIMIT 1`,
    [restaurantId],
  )
  if (!rows.length) throw new HttpError(404, 'No encontramos ese restaurante.')
  response.json({ id: restaurantId, ...settingsFromRow(rows[0]) })
})

app.get('/api/v1/restaurants/:id/reviews', async (request, response) => {
  const restaurantId = parseRestaurantId(request.params.id)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.id, r.restaurant_id AS restaurantId, u.display_name AS author,
            DATE_FORMAT(r.created_at, '%Y-%m-%d') AS date, r.rating, r.comment,
            'Comentario de cliente' AS visit
     FROM restaurant_reviews r JOIN users u ON u.id = r.user_id
     WHERE r.restaurant_id = ? ORDER BY r.created_at DESC LIMIT 200`,
    [restaurantId],
  )
  response.json(rows)
})

app.post('/api/v1/restaurants/:id/reviews', requireAuth, requireRole('customer'), async (request, response) => {
  const restaurantId = parseRestaurantId(request.params.id)
  const parsed = reviewSchema.safeParse(request.body)
  if (!parsed.success) throw new HttpError(400, 'Elige una valoración de 1 a 5 y escribe un comentario de hasta 1000 caracteres.')
  const placeName = z.string().trim().min(1).max(160).safeParse(request.body?.restaurantName)
  const [restaurants] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM restaurants WHERE id = ? LIMIT 1',
    [restaurantId],
  )
  if (!restaurants.length && /^osm-(?:node|way|relation)-\d+$/.test(restaurantId) && placeName.success) {
    await pool.execute(
      'INSERT IGNORE INTO restaurants (id, name, source) VALUES (?, ?, ?)',
      [restaurantId, placeName.data, 'osm'],
    )
  } else if (!restaurants.length) {
    throw new HttpError(404, 'No encontramos ese restaurante.')
  }
  const id = randomUUID()
  try {
    await pool.execute(
      'INSERT INTO restaurant_reviews (id, restaurant_id, user_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
      [id, restaurantId, request.account!.id, parsed.data.rating, parsed.data.comment],
    )
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'Ya publicaste un comentario para este restaurante.')
    }
    throw error
  }
  response.status(201).json({
    id,
    restaurantId,
    author: request.account!.name,
    date: new Date().toISOString().slice(0, 10),
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    visit: 'Comentario de cliente',
  })
})

app.get('/api/v1/owner/restaurants', requireAuth, requireRole('restaurant'), requireActiveRestaurant, async (request, response) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.id, s.hours, s.available_times AS availableTimes,
            s.reservation_policy AS reservationPolicy, s.price_per_person AS pricePerPerson,
            s.menu_highlights AS menuHighlights
     FROM restaurant_accounts ra
     JOIN restaurants r ON r.id = ra.restaurant_id
     LEFT JOIN restaurant_settings s ON s.restaurant_id = r.id
     WHERE ra.user_id = ?`,
    [request.account!.id],
  )
  response.json(rows.map((row) => ({ id: row.id, ...settingsFromRow(row) })))
})

app.patch('/api/v1/owner/restaurants/:id', requireAuth, requireRole('restaurant'), requireActiveRestaurant, async (request, response) => {
  const input = restaurantSettingsSchema.safeParse(request.body)
  if (!input.success) throw new HttpError(400, 'Revisa los horarios y la política de reservas.')
  const restaurantId = parseRestaurantId(request.params.id)
  const [owned] = await pool.execute<RowDataPacket[]>(
    'SELECT restaurant_id FROM restaurant_accounts WHERE user_id = ? AND restaurant_id = ? LIMIT 1',
    [request.account!.id, restaurantId],
  )
  if (!owned.length) throw new HttpError(403, 'Tu cuenta no administra este restaurante.')
  try {
    await pool.execute(
      `INSERT INTO restaurant_settings
         (restaurant_id, hours, available_times, reservation_policy, price_per_person, menu_highlights)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE hours = VALUES(hours), available_times = VALUES(available_times),
         reservation_policy = VALUES(reservation_policy), price_per_person = VALUES(price_per_person),
         menu_highlights = VALUES(menu_highlights)`,
      [
        restaurantId,
        input.data.hours,
        JSON.stringify(input.data.availableTimes),
        input.data.reservationPolicy,
        input.data.pricePerPerson,
        JSON.stringify(input.data.menuHighlights),
      ],
    )
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_NO_REFERENCED_ROW_2') {
      throw new HttpError(404, 'La ficha de este restaurante no está disponible en la guía.')
    }
    throw error
  }
  response.json(input.data)
})

app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
  if (response.headersSent) {
    next(error)
    return
  }
  if (error instanceof HttpError) {
    response.status(error.status).json({ message: error.message })
    return
  }
  if (error instanceof z.ZodError) {
    response.status(400).json({ message: 'Revisa los datos enviados.' })
    return
  }
  console.error('Unhandled API error', error)
  response.status(500).json({ message: 'Ocurrió un error interno. Inténtalo nuevamente.' })
})

function parseRestaurantId(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value
  if (!id || id.length > 120 || !/^[a-zA-Z0-9._:-]+$/.test(id)) {
    throw new HttpError(400, 'Identificador de restaurante no válido.')
  }
  return id
}

async function findAccountById(id: string): Promise<AccountRecord | null> {
  const [rows] = await pool.execute<UserRow[]>(
    `SELECT u.id, u.email, u.display_name, u.password_hash, u.role, u.plan, u.plan_status,
            u.email_verified_at, ra.domain, ra.restaurant_id
     FROM users u LEFT JOIN restaurant_accounts ra ON ra.user_id = u.id WHERE u.id = ? LIMIT 1`,
    [id],
  )
  return rows.length ? accountFromRow(rows[0]) : null
}

export async function initializeDatabase(): Promise<void> {
  const migrationsDirectory = resolve('server/migrations')
  const connection = await pool.getConnection()
  try {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name VARCHAR(160) NOT NULL PRIMARY KEY,
         applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    )
    const migrations = (await readdir(migrationsDirectory))
      .filter((name) => /^\d+_[\w-]+\.sql$/.test(name))
      .sort()
    for (const name of migrations) {
      const [applied] = await connection.execute<RowDataPacket[]>(
        'SELECT name FROM schema_migrations WHERE name = ? LIMIT 1',
        [name],
      )
      if (applied.length) continue
      const migration = await readFile(resolve(migrationsDirectory, name), 'utf8')
      for (const statement of migration.split(';').map((part) => part.trim()).filter(Boolean)) {
        await connection.query(statement)
      }
      await connection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [name])
    }
  } finally {
    connection.release()
  }
}

export { app }
