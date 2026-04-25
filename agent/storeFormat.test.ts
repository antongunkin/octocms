import { describe, expect, it } from 'vitest';

import { cosineSimilarity, decodeFloat32, encodeFloat32 } from './storeFormat';

describe('encodeFloat32 / decodeFloat32', () => {
  it('round-trips a vector losslessly', () => {
    const original = new Float32Array([1, -1, 0.5, -0.25, 1e-6, 12345.6789]);
    const decoded = decodeFloat32(encodeFloat32(original));
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('preserves all 384 dims of a typical embedding vector', () => {
    const original = new Float32Array(384);
    for (let i = 0; i < 384; i++) original[i] = Math.sin(i) * 0.1;
    const decoded = decodeFloat32(encodeFloat32(original));
    expect(decoded.length).toBe(384);
    for (let i = 0; i < 384; i++) {
      expect(decoded[i]).toBeCloseTo(original[i], 6);
    }
  });

  it('handles an empty vector', () => {
    const decoded = decodeFloat32(encodeFloat32(new Float32Array(0)));
    expect(decoded.length).toBe(0);
  });

  it('returns a fresh ArrayBuffer (not aliased to Buffer pool)', () => {
    const a = decodeFloat32(encodeFloat32(new Float32Array([1, 2, 3])));
    const b = decodeFloat32(encodeFloat32(new Float32Array([4, 5, 6])));
    expect(Array.from(a)).toEqual([1, 2, 3]);
    expect(Array.from(b)).toEqual([4, 5, 6]);
  });
});

describe('cosineSimilarity', () => {
  it('returns 1 for identical unit vectors', () => {
    const v = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 6);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 6);
  });

  it('returns -1 for anti-parallel vectors', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([-1, -2, -3]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 6);
  });

  it('is invariant to scale', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([10, 20, 30]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 6);
  });

  it('returns 0 when either vector is zero-length', () => {
    expect(cosineSimilarity(new Float32Array(0), new Float32Array(0))).toBe(0);
  });

  it('returns 0 when either vector has zero magnitude', () => {
    const a = new Float32Array([0, 0, 0]);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, b)).toBe(0);
    expect(cosineSimilarity(b, a)).toBe(0);
  });

  it('throws on length mismatch', () => {
    expect(() => cosineSimilarity(new Float32Array([1, 2]), new Float32Array([1, 2, 3]))).toThrow(/length mismatch/);
  });
});
