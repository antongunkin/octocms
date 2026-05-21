import { promises as fsPromises } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as localReader from '../../lib/localReader';
import { embedAll, loadEmbeddings } from '../../agent/embeddings';
import { embeddingsGenCommand } from './embeddingsGen';

vi.mock('../../lib/localReader', () => ({
  listLocalFilesRecursive: vi.fn(),
  listLocalCollectionFiles: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    promises: { ...actual.promises, utimes: vi.fn().mockResolvedValue(undefined) },
  };
});

vi.mock('../../agent/embeddings', () => ({
  embedAll: vi.fn().mockResolvedValue({ entries: {}, dim: 384, model: 'test' }),
  loadEmbeddings: vi.fn().mockResolvedValue({ entries: {}, dim: 384, model: 'test' }),
  serializeStore: vi.fn().mockReturnValue('{}'),
  EMBEDDINGS_STORE_PATH: 'cms/__generated__/embeddings.json',
}));

vi.mock('../lib/project', () => ({
  loadProjectConfig: vi.fn().mockResolvedValue({
    contentFolder: 'cms/content',
    mediaContentFolder: 'cms/media',
    collections: {},
  }),
  loadCollections: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/validateConfig', () => ({
  validateConfig: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  log: {
    header: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
    blank: vi.fn(),
  },
}));

// The `fs` mock above replaces `writeFileSync` / `mkdirSync` with `vi.fn()` — but
// vitest's spread-the-actual-then-override pattern is fragile for Node built-ins
// (the override silently misses in some module-graph layouts), so the test would
// otherwise clobber the real `cms/__generated__/embeddings.json`. Guard against
// that by routing each test through a temp project root.
let tmpRoot: string;
let prevCwd: string;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(localReader.listLocalFilesRecursive).mockResolvedValue([]);
  vi.mocked(localReader.listLocalCollectionFiles).mockResolvedValue([]);
  prevCwd = process.cwd();
  tmpRoot = await fsPromises.mkdtemp(path.join(tmpdir(), 'oct-emb-gen-'));
  process.chdir(tmpRoot);
});

afterEach(async () => {
  process.chdir(prevCwd);
  await fsPromises.rm(tmpRoot, { recursive: true, force: true });
});

// ─── embeddingsGenCommand — file discovery ─────────────────────────────────────

describe('embeddingsGenCommand file discovery', () => {
  it('calls listLocalFilesRecursive with content folder', async () => {
    await embeddingsGenCommand(process.cwd());

    expect(localReader.listLocalFilesRecursive).toHaveBeenCalledWith('cms/content', '.json');
  });

  it('calls listLocalCollectionFiles with media folder', async () => {
    await embeddingsGenCommand(process.cwd());

    expect(localReader.listLocalCollectionFiles).toHaveBeenCalledWith('cms/media');
  });

  it('passes combined and sorted paths to embedAll', async () => {
    vi.mocked(localReader.listLocalFilesRecursive).mockResolvedValue([
      'cms/content/post/post-1.json',
      'cms/content/post/post-2.json',
    ]);
    vi.mocked(localReader.listLocalCollectionFiles).mockResolvedValue(['cms/media/media-a.json']);

    await embeddingsGenCommand(process.cwd());

    const passedPaths = vi.mocked(embedAll).mock.calls[0][0];
    expect(passedPaths).toContain('cms/content/post/post-1.json');
    expect(passedPaths).toContain('cms/media/media-a.json');
    expect(passedPaths).toEqual([...passedPaths].sort());
  });

  it('handles empty discovery gracefully', async () => {
    await embeddingsGenCommand(process.cwd());

    const passedPaths = vi.mocked(embedAll).mock.calls[0][0];
    expect(passedPaths).toEqual([]);
  });
});

// ─── embeddingsGenCommand — store load + write ────────────────────────────────

describe('embeddingsGenCommand store I/O', () => {
  it('loads the existing store and threads it into embedAll as previous', async () => {
    const existing = { entries: { 'cms/content/post/post-1.json': { hash: 'h', vec: '' } }, dim: 384, model: 'test' };
    vi.mocked(loadEmbeddings).mockResolvedValueOnce(existing);

    await embeddingsGenCommand(process.cwd());

    const opts = vi.mocked(embedAll).mock.calls[0][1];
    expect(opts?.previous).toBe(existing);
  });

  it('writes the serialized store to cms/__generated__/embeddings.json under the project root', async () => {
    // The vi.mock('fs', ...) above can silently miss in some module-graph
    // layouts (see comment near `tmpRoot`), so verify against real fs in the
    // tmp project root — `serializeStore` is mocked to '{}' so this is safe.
    const { promises: realFs } = await vi.importActual<typeof import('fs')>('fs');
    await embeddingsGenCommand(process.cwd());

    const dest = path.join(process.cwd(), 'cms/__generated__/embeddings.json');
    const content = await realFs.readFile(dest, 'utf8').catch(() => null);
    expect(content).toBe('{}');
  });
});
