import type { CmsSession } from './types';

const IV_LENGTH = 12;
/** Browser cookie size limit — stay under 4 KB including name and attributes. */
export const MAX_SEALED_SESSION_BYTES = 3800;

/**
 * AES-256-GCM session seal using the Web Crypto API (Node 18+ / Vercel serverless).
 *
 * Key derivation: SHA-256 digest of the secret string → 256-bit AES key.
 * Wire format: base64url(iv || ciphertext) where ciphertext includes the GCM auth tag.
 */
async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLen);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function sealSession(payload: CmsSession, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveAesKey(secret);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  const sealed = base64UrlEncode(combined);
  if (sealed.length > MAX_SEALED_SESSION_BYTES) {
    throw new Error('Session payload exceeds cookie size limit after sealing.');
  }
  return sealed;
}

export async function unsealSession(sealed: string, secret: string): Promise<CmsSession | null> {
  try {
    const combined = base64UrlDecode(sealed);
    if (combined.length <= IV_LENGTH) return null;

    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);
    const key = await deriveAesKey(secret);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as CmsSession;

    if (!parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}
