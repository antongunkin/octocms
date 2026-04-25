/**
 * Phase 5 — chat-agent file attachment processing.
 *
 * Pure server-side functions that turn raw uploaded files into normalised
 * content blocks suitable for any chat provider:
 *
 *   - **DOCX (any provider)** → text via `mammoth`, prefixed with the filename.
 *   - **PDF on Anthropic** → `document_pdf` block (native pass-through).
 *   - **PDF on OpenAI / local** → text via `pdfjs-dist`, prefixed with filename.
 *   - **Plain text / Markdown** → text block, prefixed with filename.
 *
 * Both extractor libraries (`mammoth`, `pdfjs-dist`) are optional peer
 * dependencies — they're loaded lazily so projects that don't use file
 * uploads don't pay for them.
 */
import type { NormalizedContentBlock } from './providers/types';
import type { AgentConfig } from './types';

/**
 * Categorisation we apply to an uploaded file based on its filename + MIME
 * type. Drives the dispatch in {@link normalizeAttachments}.
 */
export type AttachmentKind = 'pdf' | 'docx' | 'text' | 'unsupported';

/** Raw input — what the route handler hands to {@link normalizeAttachments}. */
export type RawAttachment = {
  filename: string;
  mediaType: string;
  /** Binary content. Should already be size-checked by the caller. */
  bytes: Uint8Array;
};

/** Result of attachment normalisation, including any skipped files. */
export type NormalizedAttachmentsResult = {
  blocks: NormalizedContentBlock[];
  /** Per-file outcome — useful for the route handler to relay back to the client. */
  diagnostics: AttachmentDiagnostic[];
};

export type AttachmentDiagnostic =
  | { filename: string; status: 'ok'; kind: AttachmentKind; bytes: number }
  | { filename: string; status: 'skipped'; reason: string };

/** Decide what kind of file we're dealing with from filename + MIME. */
export function classifyAttachment(filename: string, mediaType: string): AttachmentKind {
  const lowered = filename.toLowerCase();
  const mt = (mediaType || '').toLowerCase();
  if (mt === 'application/pdf' || lowered.endsWith('.pdf')) return 'pdf';
  if (
    mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowered.endsWith('.docx')
  ) {
    return 'docx';
  }
  if (
    mt.startsWith('text/') ||
    lowered.endsWith('.txt') ||
    lowered.endsWith('.md') ||
    lowered.endsWith('.markdown')
  ) {
    return 'text';
  }
  return 'unsupported';
}

/** Validate a file against the per-attachment limit. Returns null if ok. */
export function checkAttachmentSize(
  bytes: number,
  config: Pick<AgentConfig, 'maxAttachmentBytes'>,
): string | null {
  if (bytes > config.maxAttachmentBytes) {
    return `File exceeds the ${formatBytes(config.maxAttachmentBytes)} per-file limit (got ${formatBytes(bytes)}).`;
  }
  return null;
}

/** Validate the count of attachments against the per-turn cap. */
export function checkAttachmentCount(
  count: number,
  config: Pick<AgentConfig, 'maxAttachmentsPerTurn'>,
): string | null {
  if (count > config.maxAttachmentsPerTurn) {
    return `Too many attachments — limit is ${config.maxAttachmentsPerTurn} per turn (got ${count}).`;
  }
  return null;
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

/** Tag a text snippet so the model knows it came from an attachment. */
export function wrapAttachmentText(filename: string, text: string): string {
  return `[Attached document: ${filename}]\n\n${text}`;
}

/**
 * Convert a list of raw attachments into normalised content blocks for the
 * given provider's PDF capability. PDF behaviour depends on
 * `supportsNativePdf`; everything else is text either way.
 *
 * Errors during extraction (corrupt files, missing peer deps) are reported
 * as `skipped` diagnostics — the chat continues without that attachment so a
 * single bad file doesn't break the whole turn.
 */
export async function normalizeAttachments(
  attachments: RawAttachment[],
  options: {
    supportsNativePdf: boolean;
    /** Test seam — inject extractors directly. */
    extractDocxText?: (bytes: Uint8Array) => Promise<string>;
    extractPdfText?: (bytes: Uint8Array) => Promise<string>;
  },
): Promise<NormalizedAttachmentsResult> {
  const blocks: NormalizedContentBlock[] = [];
  const diagnostics: AttachmentDiagnostic[] = [];

  const extractDocx = options.extractDocxText ?? extractDocxTextDefault;
  const extractPdf = options.extractPdfText ?? extractPdfTextDefault;

  for (const att of attachments) {
    const kind = classifyAttachment(att.filename, att.mediaType);

    if (kind === 'unsupported') {
      diagnostics.push({
        filename: att.filename,
        status: 'skipped',
        reason: `Unsupported file type "${att.mediaType || 'unknown'}". Allowed: PDF, DOCX, .txt, .md.`,
      });
      continue;
    }

    if (kind === 'text') {
      const text = bytesToString(att.bytes);
      blocks.push({ type: 'text', text: wrapAttachmentText(att.filename, text) });
      diagnostics.push({ filename: att.filename, status: 'ok', kind, bytes: att.bytes.length });
      continue;
    }

    if (kind === 'docx') {
      try {
        const text = await extractDocx(att.bytes);
        blocks.push({ type: 'text', text: wrapAttachmentText(att.filename, text) });
        diagnostics.push({ filename: att.filename, status: 'ok', kind, bytes: att.bytes.length });
      } catch (err) {
        diagnostics.push({
          filename: att.filename,
          status: 'skipped',
          reason: `DOCX extraction failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      continue;
    }

    // kind === 'pdf'
    if (options.supportsNativePdf) {
      blocks.push({
        type: 'document_pdf',
        base64: bytesToBase64(att.bytes),
        mediaType: 'application/pdf',
        filename: att.filename,
      });
      diagnostics.push({ filename: att.filename, status: 'ok', kind, bytes: att.bytes.length });
      continue;
    }

    try {
      const text = await extractPdf(att.bytes);
      blocks.push({ type: 'text', text: wrapAttachmentText(att.filename, text) });
      diagnostics.push({ filename: att.filename, status: 'ok', kind, bytes: att.bytes.length });
    } catch (err) {
      diagnostics.push({
        filename: att.filename,
        status: 'skipped',
        reason: `PDF text extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return { blocks, diagnostics };
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function bytesToBase64(bytes: Uint8Array): string {
  // Buffer is the most reliable way to get base64 in Node — avoids
  // String.fromCharCode chunk-size limits.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  // Browser fallback (the chat agent runs server-side, so this is mostly
  // for shared utilities — kept simple to stay dependency-free).
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function extractDocxTextDefault(bytes: Uint8Array): Promise<string> {
  let mammoth: typeof import('mammoth');
  try {
    mammoth = (await import('mammoth')) as unknown as typeof import('mammoth');
  } catch {
    throw new Error(
      "Optional peer dependency 'mammoth' is not installed. Run: npm install mammoth",
    );
  }
  // mammoth's `extractRawText` is happy with a `{ buffer }` input — Buffer is
  // a Uint8Array subclass in Node, so this works without a copy.
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

async function extractPdfTextDefault(bytes: Uint8Array): Promise<string> {
  type PdfJsModule = {
    getDocument: (params: { data: Uint8Array }) => { promise: Promise<PdfDocument> };
    GlobalWorkerOptions?: { workerSrc?: string };
  };
  type PdfDocument = {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfPage>;
    destroy?(): Promise<void>;
  };
  type PdfPage = {
    getTextContent(): Promise<{ items: Array<{ str?: string }> }>;
  };

  let pdfjs: PdfJsModule;
  try {
    // Use the legacy build — the modern build assumes a browser environment
    // (DOMMatrix / OffscreenCanvas) that Node does not provide. The legacy
    // build is the one Mozilla ships specifically for Node.
    pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsModule;
  } catch {
    try {
      pdfjs = (await import('pdfjs-dist')) as unknown as PdfJsModule;
    } catch {
      throw new Error(
        "Optional peer dependency 'pdfjs-dist' is not installed. Run: npm install pdfjs-dist",
      );
    }
  }

  // Disable worker — server-side we run in the main thread.
  if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = '';

  // Pass a copy because pdf.js mutates the buffer it receives.
  const data = new Uint8Array(bytes.length);
  data.set(bytes);
  const doc = await pdfjs.getDocument({ data }).promise;

  const lines: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => it.str ?? '').join(' ');
    lines.push(pageText.trim());
  }
  if (typeof doc.destroy === 'function') {
    try {
      await doc.destroy();
    } catch {
      /* best-effort */
    }
  }
  return lines.join('\n\n');
}
