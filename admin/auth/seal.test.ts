import { describe, expect, it } from 'vitest';

import { sealSession, unsealSession, MAX_SEALED_SESSION_BYTES } from './seal';
import type { CmsSession } from './types';

const SECRET = 'test-secret-at-least-32-characters-long!!';

const sampleSession: CmsSession = {
  user: { id: '42', name: 'Alice', email: 'a@example.com', image: 'https://example.com/a.png' },
  accessToken: 'gho_test_token',
};

describe('sealSession / unsealSession', () => {
  it('roundtrips a session payload', async () => {
    const sealed = await sealSession(sampleSession, SECRET);
    const restored = await unsealSession(sealed, SECRET);
    expect(restored).toEqual(sampleSession);
  });

  it('returns null for tampered ciphertext', async () => {
    const sealed = await sealSession(sampleSession, SECRET);
    const tampered = sealed.slice(0, -4) + 'xxxx';
    expect(await unsealSession(tampered, SECRET)).toBeNull();
  });

  it('returns null when the secret differs', async () => {
    const sealed = await sealSession(sampleSession, SECRET);
    expect(await unsealSession(sealed, 'other-secret-at-least-32-characters!!')).toBeNull();
  });

  it('throws when sealed payload exceeds cookie size guard', async () => {
    const huge: CmsSession = {
      user: { id: '1', name: 'x'.repeat(5000) },
      accessToken: 'y'.repeat(5000),
    };
    await expect(sealSession(huge, SECRET)).rejects.toThrow(/cookie size limit/);
    expect(MAX_SEALED_SESSION_BYTES).toBeLessThan(4096);
  });
});
