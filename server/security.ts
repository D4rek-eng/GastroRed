import { createHash, createHmac, randomBytes, randomInt, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { domainToASCII } from 'node:url'
import { config } from './config.js'

const scrypt = promisify(nodeScrypt)
const keyLength = 64

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizeDomain(domain: string): string {
  const cleaned = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/\.$/, '')
  return domainToASCII(cleaned)
}

export function isBusinessEmailForDomain(email: string, domain: string): boolean {
  const normalizedDomain = normalizeDomain(domain)
  const emailDomain = normalizeEmail(email).split('@').at(-1) ?? ''
  return (
    emailDomain === normalizedDomain &&
    /^[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)+$/i.test(normalizedDomain)
  )
}

export function newVerificationCode(): string {
  return String(randomInt(100_000, 1_000_000))
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function hashVerificationCode(code: string): string {
  return createHmac('sha256', config.SESSION_SECRET).update(code).digest('hex')
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, keyLength) as Buffer
  return `scrypt$${salt}$${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, savedKey] = storedHash.split('$')
  if (algorithm !== 'scrypt' || !salt || !savedKey || !/^[a-f\d]{128}$/i.test(savedKey)) return false
  const derivedKey = await scrypt(password, salt, keyLength) as Buffer
  const expected = Buffer.from(savedKey, 'hex')
  return timingSafeEqual(derivedKey, expected)
}

export function verifyHmacSignature(message: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(message).digest()
  let actual: Buffer
  try {
    actual = Buffer.from(signature, 'hex')
  } catch {
    return false
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function secureEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}
