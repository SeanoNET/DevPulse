import { safeStorage } from 'electron'
import { getRawStore } from './store'

const CREDENTIAL_PREFIX = 'credential:'

function canEncrypt(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function saveCredential(key: string, value: string): void {
  const store = getRawStore()
  if (!store) throw new Error('Store not initialized')

  if (canEncrypt()) {
    const encrypted = safeStorage.encryptString(value)
    store.set(`${CREDENTIAL_PREFIX}${key}`, encrypted.toString('base64'))
  } else {
    console.warn('[DevPulse] safeStorage unavailable — credentials stored with base64 encoding only (not encrypted)')
    store.set(`${CREDENTIAL_PREFIX}${key}`, Buffer.from(value).toString('base64'))
  }
}

export function isEncryptionAvailable(): boolean {
  return canEncrypt()
}

export function getCredential(key: string): string | null {
  const store = getRawStore()
  if (!store) return null
  const stored = store.get(`${CREDENTIAL_PREFIX}${key}`) as string | undefined
  if (!stored) return null

  try {
    if (canEncrypt()) {
      const buffer = Buffer.from(stored, 'base64')
      return safeStorage.decryptString(buffer)
    } else {
      return Buffer.from(stored, 'base64').toString('utf-8')
    }
  } catch {
    // If decryption fails (e.g. was stored unencrypted), try plain base64
    try {
      return Buffer.from(stored, 'base64').toString('utf-8')
    } catch {
      return null
    }
  }
}

export function deleteCredential(key: string): void {
  const store = getRawStore()
  if (!store) return
  store.delete(`${CREDENTIAL_PREFIX}${key}`)
}

export function hasCredential(key: string): boolean {
  const store = getRawStore()
  if (!store) return false
  return store.has(`${CREDENTIAL_PREFIX}${key}`)
}
