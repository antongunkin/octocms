import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { validateContent } from '../lib/contentValidator';
import type { Config } from '../../types';

const TMP_DIR = join(process.cwd(), '.tmp-validate-cmd-test');

function makeConfig(): Config {
  return {
    projectName: 'Test',
    contentFolder: 'content',
    mediaFolder: 'public/media',
    mediaAllowedFormats: ['png'],
    git: { baseBranch: 'main' },
    collections: {
      post: {
        label: 'Post',
        hasMany: true,
        fields: {
          title: { label: 'Title', format: 'string', required: true },
        },
      },
    },
  };
}

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('validate command integration', () => {
  it('returns empty errors for valid content', () => {
    const dir = join(TMP_DIR, 'content', 'post');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'post-1.json'),
      JSON.stringify({ sys: { id: '1', type: 'post' }, fields: { title: 'OK' } }),
    );

    const result = validateContent(TMP_DIR, makeConfig());
    expect(result.errors).toHaveLength(0);
    expect(result.counts.post).toBe(1);
  });

  it('reports multiple errors across files', () => {
    const dir = join(TMP_DIR, 'content', 'post');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'post-1.json'), JSON.stringify({ sys: { id: '1', type: 'post' }, fields: { title: '' } }));
    writeFileSync(join(dir, 'post-2.json'), JSON.stringify({ sys: { id: '2', type: 'wrong' }, fields: { title: '' } }));

    const result = validateContent(TMP_DIR, makeConfig());
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('handles empty collections gracefully', () => {
    // No content directory at all
    const result = validateContent(TMP_DIR, makeConfig());
    expect(result.errors).toHaveLength(0);
    expect(result.counts.post).toBe(0);
  });
});
