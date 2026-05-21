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

/**
 * `onnxruntime-node` (a transitive dep of `@huggingface/transformers`) loads
 * `libonnxruntime.so.1` via a synchronous `require` at module top-level. On
 * Vercel the .so isn't bundled by default, so the require throws and — worse
 * — the package's internal init also fires an *unhandled* rejection that
 * crashes the lambda with exit 128 even though our own `try`/`catch` handles
 * the import.
 *
 * Install a one-time process-level filter that swallows just those native-
 * load rejections. Other unhandled rejections still crash with the default
 * Node behaviour.
 */
let nativeRejectionFilterInstalled = false;
function installNativeRejectionFilter(): void {
  if (nativeRejectionFilterInstalled) return;
  if (typeof process === 'undefined' || typeof process.on !== 'function') return;
  nativeRejectionFilterInstalled = true;
  process.on('unhandledRejection', (reason: unknown) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    if (/libonnxruntime|onnxruntime-node|ERR_DLOPEN_FAILED/i.test(msg)) {
      // Already surfaced via the embedder's caller catch path. Swallow so
      // the lambda doesn't exit 128 on a content write.
      return;
    }
    // Preserve Node's default crash behaviour for unrelated rejections.
    setImmediate(() => {
      throw reason;
    });
  });
}

class LocalTransformersEmbedder implements Embedder {
  readonly modelId: string;
  readonly dim: number;
  private pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;
  private permanentFailure: Error | null = null;

  constructor(modelId: string = DEFAULT_MODEL_ID, dim: number = DEFAULT_DIM) {
    this.modelId = modelId;
    this.dim = dim;
  }

  private async getPipeline(): Promise<FeatureExtractionPipeline> {
    if (this.permanentFailure) throw this.permanentFailure;
    if (this.pipelinePromise) return this.pipelinePromise;
    installNativeRejectionFilter();
    const p = (async (): Promise<FeatureExtractionPipeline> => {
      let mod: typeof import('@huggingface/transformers');
      try {
        mod = await import('@huggingface/transformers');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/libonnxruntime|onnxruntime-node|ERR_DLOPEN_FAILED/i.test(msg)) {
          throw new Error(
            `Embeddings unavailable: '@huggingface/transformers' loaded but its native ` +
              `dependency 'onnxruntime-node' could not load (${msg}). On Vercel, add ` +
              `'./node_modules/onnxruntime-node/**' to 'outputFileTracingIncludes' ` +
              `for the relevant routes, or rely on offline 'npx octocms embeddings:gen'.`,
          );
        }
        throw new Error(
          `Embeddings require the optional peer dep '@huggingface/transformers'. Install it with: npm install @huggingface/transformers`,
        );
      }
      const pipe = (await mod.pipeline('feature-extraction', this.modelId)) as unknown as FeatureExtractionPipeline;
      return pipe;
    })();
    // Mark as handled at promise-creation time so a rejection that beats the
    // first await (e.g. native-lib load) doesn't fire unhandledRejection.
    p.catch((e: unknown) => {
      this.permanentFailure = e instanceof Error ? e : new Error(String(e));
      this.pipelinePromise = null;
    });
    this.pipelinePromise = p;
    return p;
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
