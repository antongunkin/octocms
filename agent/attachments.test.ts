import { describe, expect, it } from 'vitest';

import {
  checkAttachmentCount,
  checkAttachmentSize,
  classifyAttachment,
  normalizeAttachments,
  wrapAttachmentText,
  type AttachmentDiagnostic,
} from './attachments';

const enc = (s: string) => new TextEncoder().encode(s);

describe('classifyAttachment', () => {
  it.each([
    ['report.pdf', 'application/pdf', 'pdf'],
    ['report.PDF', '', 'pdf'], // case-insensitive extension
    ['notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
    ['notes.docx', '', 'docx'],
    ['readme.md', 'text/markdown', 'text'],
    ['notes.txt', 'text/plain', 'text'],
    ['noext', 'text/plain', 'text'],
    ['photo.png', 'image/png', 'unsupported'],
    ['archive.zip', 'application/zip', 'unsupported'],
  ])('classifies %s (%s) as %s', (filename, mediaType, expected) => {
    expect(classifyAttachment(filename, mediaType)).toBe(expected);
  });
});

describe('checkAttachmentSize / checkAttachmentCount', () => {
  it('rejects files larger than the cap', () => {
    expect(checkAttachmentSize(11_000_000, { maxAttachmentBytes: 10_000_000 })).toMatch(/exceeds/);
  });

  it('passes files at or below the cap', () => {
    expect(checkAttachmentSize(10_000_000, { maxAttachmentBytes: 10_000_000 })).toBeNull();
  });

  it('rejects too many attachments per turn', () => {
    expect(checkAttachmentCount(4, { maxAttachmentsPerTurn: 3 })).toMatch(/Too many/);
  });

  it('passes when count is at the cap', () => {
    expect(checkAttachmentCount(3, { maxAttachmentsPerTurn: 3 })).toBeNull();
  });
});

describe('wrapAttachmentText', () => {
  it('prefixes the text with the filename so the model knows it came from a file', () => {
    expect(wrapAttachmentText('report.pdf', 'Hello world')).toBe(
      '[Attached document: report.pdf]\n\nHello world',
    );
  });
});

describe('normalizeAttachments', () => {
  it('passes PDFs through as document_pdf when supportsNativePdf is true', async () => {
    const result = await normalizeAttachments(
      [{ filename: 'a.pdf', mediaType: 'application/pdf', bytes: enc('%PDF-1.4 fake') }],
      { supportsNativePdf: true },
    );
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      type: 'document_pdf',
      mediaType: 'application/pdf',
      filename: 'a.pdf',
    });
    // base64 round-trip sanity check
    const decoded = Buffer.from((result.blocks[0] as { base64: string }).base64, 'base64').toString();
    expect(decoded).toBe('%PDF-1.4 fake');
    expect(result.diagnostics).toEqual<AttachmentDiagnostic[]>([
      { filename: 'a.pdf', status: 'ok', kind: 'pdf', bytes: enc('%PDF-1.4 fake').length },
    ]);
  });

  it('extracts PDF text when supportsNativePdf is false', async () => {
    const result = await normalizeAttachments(
      [{ filename: 'a.pdf', mediaType: 'application/pdf', bytes: new Uint8Array([1, 2, 3]) }],
      {
        supportsNativePdf: false,
        extractPdfText: async () => 'fake pdf text',
      },
    );
    expect(result.blocks).toEqual([
      { type: 'text', text: '[Attached document: a.pdf]\n\nfake pdf text' },
    ]);
  });

  it('extracts DOCX text on every provider', async () => {
    const result = await normalizeAttachments(
      [
        {
          filename: 'note.docx',
          mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          bytes: new Uint8Array([1]),
        },
      ],
      {
        supportsNativePdf: true,
        extractDocxText: async () => 'Hello DOCX',
      },
    );
    expect(result.blocks).toEqual([
      { type: 'text', text: '[Attached document: note.docx]\n\nHello DOCX' },
    ]);
  });

  it('inlines plain text and markdown directly', async () => {
    const result = await normalizeAttachments(
      [
        { filename: 'readme.md', mediaType: 'text/markdown', bytes: enc('# Title\n\nBody') },
        { filename: 'notes.txt', mediaType: 'text/plain', bytes: enc('Some notes') },
      ],
      { supportsNativePdf: true },
    );
    expect(result.blocks).toEqual([
      { type: 'text', text: '[Attached document: readme.md]\n\n# Title\n\nBody' },
      { type: 'text', text: '[Attached document: notes.txt]\n\nSome notes' },
    ]);
  });

  it('skips unsupported file types but keeps processing the rest', async () => {
    const result = await normalizeAttachments(
      [
        { filename: 'photo.png', mediaType: 'image/png', bytes: new Uint8Array([1]) },
        { filename: 'notes.txt', mediaType: 'text/plain', bytes: enc('ok') },
      ],
      { supportsNativePdf: true },
    );
    expect(result.blocks).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ filename: 'photo.png', status: 'skipped' });
    expect(result.diagnostics[1]).toMatchObject({ filename: 'notes.txt', status: 'ok' });
  });

  it('reports extraction errors as skipped rather than throwing', async () => {
    const result = await normalizeAttachments(
      [{ filename: 'broken.docx', mediaType: '', bytes: new Uint8Array([1]) }],
      {
        supportsNativePdf: true,
        extractDocxText: async () => {
          throw new Error('mammoth: corrupt zip');
        },
      },
    );
    expect(result.blocks).toEqual([]);
    expect(result.diagnostics[0]).toMatchObject({
      filename: 'broken.docx',
      status: 'skipped',
      reason: expect.stringContaining('mammoth: corrupt zip'),
    });
  });
});
