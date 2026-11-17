import { gcm } from '@noble/ciphers/aes.js';
import { hexToBytes, bytesToHex, bytesToUtf8, utf8ToBytes, randomBytes } from '@noble/ciphers/utils.js';
import * as SecureStore from 'expo-secure-store';

const KEY_NAME = 'manage.queue-key';

let cachedKey: Uint8Array | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

async function loadKey(): Promise<Uint8Array> {
  if (cachedKey) return cachedKey;
  const stored = await SecureStore.getItemAsync(KEY_NAME);
  if (stored) {
    cachedKey = hexToBytes(stored);
    return cachedKey;
  }
  const created = randomBytes(32);
  await SecureStore.setItemAsync(KEY_NAME, bytesToHex(created), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  cachedKey = created;
  return created;
}

export async function encryptJson(value: unknown): Promise<string> {
  const key = await loadKey();
  const nonce = randomBytes(12);
  const cipher = gcm(key, nonce);
  const plaintext = utf8ToBytes(JSON.stringify(value));
  const sealed = cipher.encrypt(plaintext);
  return bytesToHex(nonce) + ':' + bytesToHex(sealed);
}

export async function decryptJson<T>(payload: string | null): Promise<T | null> {
  if (!payload) return null;
  const [nonceHex, sealedHex] = payload.split(':');
  if (!nonceHex || !sealedHex) return null;
  const key = await loadKey();
  const plaintext = gcm(key, hexToBytes(nonceHex)).decrypt(hexToBytes(sealedHex));
  return JSON.parse(bytesToUtf8(plaintext)) as T;
}

/** Serialises read-modify-write cycles so the foreground app and the background task never clobber each other. */
export function withLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = writeChain.then(operation, operation);
  writeChain = run.catch(() => undefined);
  return run;
}
