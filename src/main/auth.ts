import { safeStorage } from 'electron'
import { getRawStore } from './store'

const CREDENTIAL_PREFIX = 'credential:'

export function saveCredential(key: string, value: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS keychain encryption is not available')
  }
  const store = getRawStore()
  if (!store) throw new Error('Store not initialized')
  const encrypted = safeStorage.encryptString(value)
  store.set(`${CREDENTIAL_PREFIX}${key}`, encrypted.toString('base64'))
}

export function getCredential(key: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null
  const store = getRawStore()
  if (!store) return null
  const encrypted = store.get(`${CREDENTIAL_PREFIX}${key}`) as string | undefined
  if (!encrypted) return null
  try {
    const buffer = Buffer.from(encrypted, 'base64')
    return safeStorage.decryptString(buffer)
  } catch {
    return null
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
