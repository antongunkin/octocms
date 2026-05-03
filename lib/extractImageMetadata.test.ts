import { describe, expect, it, vi } from 'vitest';

import { extractImageMetadata } from './extractImageMetadata';

vi.mock('sharp', () => {
  // Minimal sharp test double — return the metadata pipeline shape, but make
  // the blur pipeline trackable so we can assert it doesn't run when opted out.
  const blurToBuffer = vi.fn(async () => Buffer.from([0x99, 0x99, 0x99]));
  const sharpFn = vi.fn(() => ({
    metadata: vi.fn(async () => ({ width: 100, height: 80 })),
    resize: vi.fn(() => ({
      jpeg: vi.fn(() => ({
        toBuffer: blurToBuffer,
      })),
    })),
  }));
  // Expose the spy for assertions via a module-level handle.
  (sharpFn as unknown as { __blurToBuffer: typeof blurToBuffer }).__blurToBuffer = blurToBuffer;
  return { default: sharpFn };
});

describe('extractImageMetadata', () => {
  it('returns dimensions + blur by default', async () => {
    const out = await extractImageMetadata(Buffer.from('x'));
    expect(out.width).toBe(100);
    expect(out.height).toBe(80);
    expect(out.blurDataURL).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('skips blur generation when generateBlur=false', async () => {
    const sharp = (await import('sharp')).default as unknown as { __blurToBuffer: ReturnType<typeof vi.fn> };
    sharp.__blurToBuffer.mockClear();
    const out = await extractImageMetadata(Buffer.from('x'), { generateBlur: false });
    expect(out.width).toBe(100);
    expect(out.height).toBe(80);
    expect(out.blurDataURL).toBeNull();
    expect(sharp.__blurToBuffer).not.toHaveBeenCalled();
  });
});
