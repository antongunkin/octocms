/**
 * Embedding adapter — turns text into 384-dim float vectors.
 *
 * The default implementation, `LocalTransformersEmbedder`, runs
 * `Xenova/bge-small-en-v1.5` in-process via `@huggingface/transformers`. No
 * network calls after the model is cached, no LM Studio dependency, no key.
 *
 * The adapter is intentionally tiny so we can swap in a hosted provider
 * (Voyage / OpenAI) later without touching the rest of the agent.
 */

export interface Embedder {
  /** Embed a batch of texts. The returned array matches `texts` 1:1. */
  embed(texts: string[]): Promise<Float32Array[]>;
  /** Vector dimensionality — 384 for bge-small, etc. */
  readonly dim: number;
  /** Identifier written into the store header so we can detect model swaps. */
  readonly modelId: string;
}

const DEFAULT_MODEL_ID = 'Xenova/bge-small-en-v1.5';
const DEFAULT_DIM = 384;

type FeatureExtractionPipeline = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array; dims: number[] }>;

class LocalTransformersEmbedder implements Embedder {
  readonly modelId: string;
  readonly dim: number;
  private pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

  constructor(modelId: string = DEFAULT_MODEL_ID, dim: number = DEFAULT_DIM) {
    this.modelId = modelId;
    this.dim = dim;
  }

  private async getPipeline(): Promise<FeatureExtractionPipeline> {
    if (this.pipelinePromise) return this.pipelinePromise;
    this.pipelinePromise = (async () => {
      let mod: typeof import('@huggingface/transformers');
      try {
        mod = await import('@huggingface/transformers');
      } catch (e) {
        throw new Error(
          `Embeddings require the optional peer dep '@huggingface/transformers'. Install it with: npm install @huggingface/transformers`,
        );
      }
      const pipe = (await mod.pipeline('feature-extraction', this.modelId)) as unknown as FeatureExtractionPipeline;
      return pipe;
    })();
    return this.pipelinePromise;
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    const pipe = await this.getPipeline();
    // bge-small expects mean-pooled, L2-normalised embeddings — the model card
    // and Xenova's transformers.js examples both prescribe these defaults.
    const output = await pipe(texts, { pooling: 'mean', normalize: true });
    const flat = output.data;
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i++) {
      const start = i * this.dim;
      const slice = new Float32Array(this.dim);
      slice.set(flat.subarray(start, start + this.dim));
      out.push(slice);
    }
    return out;
  }
}

let defaultEmbedder: Embedder | null = null;

/** Lazy singleton — first call kicks off the model load (~3–10s cold). */
export function getDefaultEmbedder(): Embedder {
  if (!defaultEmbedder) defaultEmbedder = new LocalTransformersEmbedder();
  return defaultEmbedder;
}

/** Test seam: replace or reset the singleton. */
export function setDefaultEmbedder(embedder: Embedder | null): void {
  defaultEmbedder = embedder;
}

export { LocalTransformersEmbedder, DEFAULT_MODEL_ID, DEFAULT_DIM };
