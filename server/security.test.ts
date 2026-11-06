import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { hashPassword, isBusinessEmailForDomain, normalizeDomain, secureEquals, verifyHmacSignature, verifyPassword } from './security.js'

describe('API security helpers', () => {
  it('hashes passwords with unique salts and verifies them', async () => {
    const first = await hashPassword('una-contrasena-larga')
    const second = await hashPassword('una-contrasena-larga')

    expect(first).not.toBe(second)
    expect(await verifyPassword('una-contrasena-larga', first)).toBe(true)
    expect(await verifyPassword('otra-contrasena-larga', first)).toBe(false)
    expect(await verifyPassword('una-contrasena-larga', 'plain-text')).toBe(false)
  })

  it('normalizes business domains and verifies corporate email domains', () => {
    expect(normalizeDomain('HTTPS://Restaurante.com/')).toBe('restaurante.com')
    expect(isBusinessEmailForDomain('duena@restaurante.com', 'restaurante.com')).toBe(true)
    expect(isBusinessEmailForDomain('duena@otro.com', 'restaurante.com')).toBe(false)
    expect(isBusinessEmailForDomain('duena@restaurante.com', 'restaurante.com.evil')).toBe(false)
  })

  it('compares verification codes without string equality', () => {
    expect(secureEquals('código', 'código')).toBe(true)
    expect(secureEquals('código', 'codigo')).toBe(false)
  })

  it('validates payment webhook HMAC signatures', () => {
    const message = 'id:preapproval-123;request-id:req-123;ts:123456;'
    const secret = 'mercadopago-webhook-secret'
    const signature = createHmac('sha256', secret).update(message).digest('hex')

    expect(verifyHmacSignature(message, signature, secret)).toBe(true)
    expect(verifyHmacSignature(message, signature, 'wrong-secret')).toBe(false)
  })
})
