/**
 * On-disk format helpers for the embeddings store.
 *
 * Embedding vectors are stored as base64-encoded `Float32Array` payloads in
 * `cms/__generated__/embeddings.json`. Base64 keeps them ASCII-safe for JSON
 * (no NaN escaping, no array-of-numbers bloat) while still round-tripping
 * losslessly to `Float32Array` for in-process cosine similarity.
 */

/** Encode a `Float32Array` to a base64 string. */
export function encodeFloat32(vec: Float32Array): string {
  // Wrap the underlying buffer in a Uint8Array view, then base64-encode it.
  const bytes = new Uint8Array(vec.buffer, vec.byteOffset, vec.byteLength);
  return Buffer.from(bytes).toString('base64');
}

/** Decode a base64 string back into a `Float32Array`. */
export function decodeFloat32(b64: string): Float32Array {
  const buf = Buffer.from(b64, 'base64');
  // Copy into a fresh ArrayBuffer so the returned view is not tied to Buffer's
  // pooled allocator (Buffer instances may share memory with other Buffers).
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return new Float32Array(ab);
}

/**
 * Cosine similarity in `[-1, 1]`. Returns `0` for zero-length inputs or when
 * either vector has zero magnitude. Both vectors must have the same length —
 * mismatched lengths throw to surface programmer error early.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: length mismatch (${a.length} vs ${b.length})`);
  }
  if (a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
