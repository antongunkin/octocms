import fsPromises from 'fs/promises';
import path from 'path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as github from './github';
import { mediaRoute as GET } from './mediaRoute';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
}));

vi.mock('./github', () => ({
  isProductionMode: vi.fn(() => false),
  readGitHubBinaryFilePublic: vi.fn(),
}));

const cookieStore = { get: vi.fn(() => undefined as { value: string } | undefined) };
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStore),
}));

// ─── Helper ──────────────────────────────────────────────────────────────────

const makeRequest = (slug: string[]) => new Request(`http://localhost/media/${slug.join('/')}`);

const makeParams = (slug: string[]) =>
  ({ params: Promise.resolve({ slug }) }) as { params: Promise<{ slug: string[] }> };

// ─── Dev mode (local filesystem) ─────────────────────────────────────────────

describe('GET /media — dev mode', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(github.isProductionMode).mockReturnValue(false);
  });

  it('serves a PNG file with correct content-type', async () => {
    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    vi.mocked(fsPromises.readFile).mockResolvedValue(imageBytes as any);

    const response = await GET(makeRequest(['img.png']), makeParams(['img.png']));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toContain('immutable');
    expect(fsPromises.readFile).toHaveBeenCalledWith(path.join(process.cwd(), 'public', 'media', 'img.png'));
  });

  it('serves a JPEG file with correct content-type', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from('jpeg') as any);

    const response = await GET(makeRequest(['photo.jpg']), makeParams(['photo.jpg']));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
  });

  it('serves a WebP file', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from('webp') as any);

    const response = await GET(makeRequest(['banner.webp']), makeParams(['banner.webp']));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/webp');
  });

  it('serves files with unknown extension as octet-stream', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from('bin') as any);

    const response = await GET(makeRequest(['file.bin']), makeParams(['file.bin']));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
  });

  it('returns 404 when file does not exist', async () => {
    vi.mocked(fsPromises.readFile).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

    const response = await GET(makeRequest(['missing.png']), makeParams(['missing.png']));

    expect(response.status).toBe(404);
  });

  it('joins multi-segment slug into a filename', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from('data') as any);

    await GET(makeRequest(['uuid-abc', 'photo.png']), makeParams(['uuid-abc', 'photo.png']));

    expect(fsPromises.readFile).toHaveBeenCalledWith(
      path.join(process.cwd(), 'public', 'media', 'uuid-abc', 'photo.png'),
    );
  });

  it('does not call GitHub API in dev mode', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from('data') as any);

    await GET(makeRequest(['img.png']), makeParams(['img.png']));

    expect(github.readGitHubBinaryFilePublic).not.toHaveBeenCalled();
  });
});

// ─── Production mode (GitHub API proxy) ──────────────────────────────────────

describe('GET /media — production mode', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    cookieStore.get.mockReturnValue(undefined);
  });

  it('fetches image from GitHub and returns it', async () => {
    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    vi.mocked(github.readGitHubBinaryFilePublic).mockResolvedValue(imageBytes);

    const response = await GET(makeRequest(['abc-123.png']), makeParams(['abc-123.png']));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toContain('immutable');
    expect(github.readGitHubBinaryFilePublic).toHaveBeenCalledWith('public/media/abc-123.png', undefined);
  });

  it('reads from active feature branch when cookie is set, falls back to published branch on miss', async () => {
    cookieStore.get.mockReturnValue({ value: 'cms-feature-x' });
    vi.mocked(github.readGitHubBinaryFilePublic)
      .mockResolvedValueOnce(null) // first call (active branch) misses
      .mockResolvedValueOnce(Buffer.from('img-bytes')); // second call (published branch) hits

    const response = await GET(makeRequest(['abc-123.png']), makeParams(['abc-123.png']));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=60');
    expect(github.readGitHubBinaryFilePublic).toHaveBeenNthCalledWith(1, 'public/media/abc-123.png', 'cms-feature-x');
    expect(github.readGitHubBinaryFilePublic).toHaveBeenNthCalledWith(2, 'public/media/abc-123.png');
  });

  it('returns the asset directly from the active feature branch (no fallback) when found', async () => {
    cookieStore.get.mockReturnValue({ value: 'cms-feature-x' });
    vi.mocked(github.readGitHubBinaryFilePublic).mockResolvedValueOnce(Buffer.from('img-bytes'));

    const response = await GET(makeRequest(['abc-123.png']), makeParams(['abc-123.png']));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=60');
    expect(github.readGitHubBinaryFilePublic).toHaveBeenCalledTimes(1);
    expect(github.readGitHubBinaryFilePublic).toHaveBeenCalledWith('public/media/abc-123.png', 'cms-feature-x');
  });

  it('returns 404 when GitHub returns null', async () => {
    vi.mocked(github.readGitHubBinaryFilePublic).mockResolvedValue(null);

    const response = await GET(makeRequest(['ghost.png']), makeParams(['ghost.png']));

    expect(response.status).toBe(404);
  });

  it('does not touch the local filesystem in production mode', async () => {
    vi.mocked(github.readGitHubBinaryFilePublic).mockResolvedValue(Buffer.from('data'));

    await GET(makeRequest(['img.avif']), makeParams(['img.avif']));

    expect(fsPromises.readFile).not.toHaveBeenCalled();
  });

  it('correctly maps avif content-type', async () => {
    vi.mocked(github.readGitHubBinaryFilePublic).mockResolvedValue(Buffer.from('avif'));

    const response = await GET(makeRequest(['photo.avif']), makeParams(['photo.avif']));

    expect(response.headers.get('Content-Type')).toBe('image/avif');
  });

  it('correctly maps gif content-type', async () => {
    vi.mocked(github.readGitHubBinaryFilePublic).mockResolvedValue(Buffer.from('gif'));

    const response = await GET(makeRequest(['anim.gif']), makeParams(['anim.gif']));

    expect(response.headers.get('Content-Type')).toBe('image/gif');
  });
});
