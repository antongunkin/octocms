import fsPromises from 'fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Config } from '../../types';

import * as githubModule from '../github';

import * as buildModule from './build';
import * as filesModule from './files';
import { getSchema, previewSchemaChange, saveSchema } from './schema';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: 'cms/edits' }) })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock('../github', () => ({
  isProductionMode: vi.fn(() => false),
  getGitHubFile: vi.fn(),
  saveGitHubFile: vi.fn(),
  commitMultipleFilesToGitHub: vi.fn(async () => ({ sha: 'fake-sha' })),
}));

vi.mock('./files', () => ({
  assertFeatureBranchForWritesIfRequired: vi.fn(),
  getContentFiles: vi.fn(),
  getFile: vi.fn(),
}));

vi.mock('./build', () => ({
  buildJsons: vi.fn(async () => ({ success: true })),
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
    rename: vi.fn(),
  },
}));

const baseConfig: Config = {
  projectName: 'Test',
  contentFolder: 'cms/content',
  mediaFolder: 'public/media',
  mediaAllowedFormats: ['png'],
  git: { baseBranch: 'main' },
  collections: {
    post: {
      label: 'Post',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', entryTitle: true, required: true },
      },
    },
  },
};

const mockedFs = vi.mocked(fsPromises);
const mockedGithub = vi.mocked(githubModule);
const mockedFiles = vi.mocked(filesModule);
const mockedBuild = vi.mocked(buildModule);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGithub.isProductionMode.mockReturnValue(false);
});

// ---------------------------------------------------------------------------
// getSchema
// ---------------------------------------------------------------------------

describe('getSchema', () => {
  it('reads from local fs in dev mode', async () => {
    mockedFs.readFile.mockResolvedValue(JSON.stringify(baseConfig));

    const result = await getSchema();

    expect(result).toEqual(baseConfig);
    expect(mockedFs.readFile).toHaveBeenCalledWith(expect.stringContaining('cms/schema.json'), 'utf8');
    expect(mockedGithub.getGitHubFile).not.toHaveBeenCalled();
  });

  it('reads from GitHub in production using the active branch cookie', async () => {
    mockedGithub.isProductionMode.mockReturnValue(true);
    mockedGithub.getGitHubFile.mockResolvedValue({ content: JSON.stringify(baseConfig), sha: 'abc' });

    const result = await getSchema();

    expect(result).toEqual(baseConfig);
    expect(mockedGithub.getGitHubFile).toHaveBeenCalledWith('cms/schema.json', 'cms/edits');
    expect(mockedFs.readFile).not.toHaveBeenCalled();
  });

  it('throws when GitHub returns nothing for cms/schema.json', async () => {
    mockedGithub.isProductionMode.mockReturnValue(true);
    mockedGithub.getGitHubFile.mockResolvedValue(null);

    await expect(getSchema()).rejects.toThrow(/schema not found/);
  });
});

// ---------------------------------------------------------------------------
// previewSchemaChange
// ---------------------------------------------------------------------------

describe('previewSchemaChange', () => {
  it('returns valid: false with errors when validation fails', async () => {
    const broken = { ...baseConfig, collections: { broken: { label: 'Broken', fields: {} } } };

    const result = await previewSchemaChange(broken);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/at least one field/);
    expect(result.changes).toEqual([]);
    expect(result.impact).toEqual([]);
  });

  it('returns valid: true with empty impact when nothing changes', async () => {
    mockedFs.readFile.mockResolvedValue(JSON.stringify(baseConfig));
    mockedFiles.getContentFiles.mockResolvedValue([]);

    const result = await previewSchemaChange(baseConfig);

    expect(result.valid).toBe(true);
    expect(result.changes).toEqual([]);
    expect(result.impact).toEqual([]);
  });

  it('lists affected entries when a collection is removed', async () => {
    mockedFs.readFile.mockResolvedValue(JSON.stringify(baseConfig));
    mockedFiles.getContentFiles.mockImplementation(async (collection: string = '**') => {
      if (collection === 'post' || collection === '**') return ['cms/content/post/post-p1.json'];
      return [];
    });
    mockedFiles.getFile.mockResolvedValue({
      sys: { id: 'p1', type: 'post', status: 'merged' },
      fields: { title: 'Hello' },
    });

    const next: Config = { ...baseConfig, collections: {} };
    const result = await previewSchemaChange(next);

    expect(result.valid).toBe(true);
    expect(result.changes).toContainEqual({ kind: 'collection-removed', collection: 'post' });
    expect(result.impact).toHaveLength(1);
    expect(result.impact[0]).toMatchObject({
      path: 'cms/content/post/post-p1.json',
      type: 'post',
      id: 'post-p1',
    });
    expect(result.impact[0].reasons.join(' ')).toMatch(/collection deleted/);
  });

  it('lists entries whose value cannot be coerced after a field-format change', async () => {
    const prev: Config = {
      ...baseConfig,
      collections: {
        post: {
          label: 'Post',
          hasMany: true,
          fields: {
            title: { label: 'Title', format: 'string', entryTitle: true, required: true },
            count: { label: 'Count', format: 'string' },
          },
        },
      },
    };
    mockedFs.readFile.mockResolvedValue(JSON.stringify(prev));
    mockedFiles.getContentFiles.mockResolvedValue(['cms/content/post/post-p1.json']);
    mockedFiles.getFile.mockResolvedValue({
      sys: { id: 'p1', type: 'post', status: 'merged' },
      fields: { title: 'Hi', count: 'not a number' },
    });

    const next: Config = {
      ...prev,
      collections: {
        post: {
          ...prev.collections.post,
          fields: {
            ...prev.collections.post.fields,
            count: { label: 'Count', format: 'number' },
          },
        },
      },
    };

    const result = await previewSchemaChange(next);

    expect(result.changes).toContainEqual({
      kind: 'field-format-changed',
      collection: 'post',
      field: 'count',
      from: 'string',
      to: 'number',
    });
    expect(result.impact).toHaveLength(1);
    expect(result.impact[0].warnings.join(' ')).toMatch(/could not be coerced/);
  });

  it('reports cross-collection impact for entries referencing a removed collection', async () => {
    const prev: Config = {
      ...baseConfig,
      collections: {
        post: {
          label: 'Post',
          hasMany: true,
          fields: {
            title: { label: 'Title', format: 'string', entryTitle: true, required: true },
            authors: {
              label: 'Authors',
              format: 'reference',
              reference: { collections: ['author'], cardinality: 'many' },
            },
          },
        },
        author: {
          label: 'Author',
          hasMany: true,
          fields: { name: { label: 'Name', format: 'string', entryTitle: true } },
        },
      },
    };
    mockedFs.readFile.mockResolvedValue(JSON.stringify(prev));
    mockedFiles.getContentFiles.mockImplementation(async (collection: string = '**') => {
      if (collection === 'author') return ['cms/content/author/author-a1.json'];
      return ['cms/content/post/post-p1.json', 'cms/content/author/author-a1.json'];
    });
    mockedFiles.getFile.mockImplementation(async (path: string) => {
      if (path.includes('/post/')) {
        return {
          sys: { id: 'p1', type: 'post', status: 'merged' },
          fields: { title: 'Hi', authors: JSON.stringify(['author-a1.json']) },
        };
      }
      return { sys: { id: 'a1', type: 'author', status: 'merged' }, fields: { name: 'Alice' } };
    });

    const next: Config = {
      ...prev,
      collections: {
        post: {
          ...prev.collections.post,
          fields: {
            title: prev.collections.post.fields.title,
          },
        },
      },
    };

    const result = await previewSchemaChange(next);

    expect(result.valid).toBe(true);
    expect(result.changes).toContainEqual({ kind: 'collection-removed', collection: 'author' });
    const postImpact = result.impact.find((i) => i.path === 'cms/content/post/post-p1.json');
    expect(postImpact).toBeDefined();
    // The authors field is also removed in this config, so the direct-collection
    // pass surfaces the post entry first (as a field-removed hit). Both the
    // field deletion and the cross-collection prune are data loss.
    expect(postImpact?.reasons.join(' ')).toMatch(/field deleted: authors/);
    expect(postImpact?.dataLoss).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 6 — refined impact analysis + cross-collection rewrites
// ---------------------------------------------------------------------------

describe('previewSchemaChange — Phase 6', () => {
  const refConfig = (): Config => ({
    projectName: 'Test',
    contentFolder: 'cms/content',
    mediaFolder: 'public/media',
    mediaAllowedFormats: ['png'],
    git: { baseBranch: 'main' },
    collections: {
      post: {
        label: 'Post',
        hasMany: true,
        fields: {
          title: { label: 'Title', format: 'string', entryTitle: true, required: true },
          authors: { label: 'Authors', format: 'reference', reference: { collections: ['author'] } },
        },
      },
      author: {
        label: 'Author',
        hasMany: true,
        fields: { name: { label: 'Name', format: 'string', entryTitle: true } },
      },
    },
  });

  it('skips entries that have no value at the deleted field (no-op rewrites)', async () => {
    const prev: Config = {
      ...baseConfig,
      collections: {
        post: {
          label: 'Post',
          hasMany: true,
          fields: {
            title: { label: 'Title', format: 'string', entryTitle: true, required: true },
            tagline: { label: 'Tagline', format: 'string' },
          },
        },
      },
    };
    mockedFs.readFile.mockResolvedValue(JSON.stringify(prev));
    mockedFiles.getContentFiles.mockResolvedValue([
      'cms/content/post/post-with.json',
      'cms/content/post/post-without.json',
    ]);
    mockedFiles.getFile.mockImplementation(async (p: string) => {
      if (p.endsWith('post-with.json')) {
        return { sys: { id: 'with', type: 'post' }, fields: { title: 'Has', tagline: 'Body' } };
      }
      return { sys: { id: 'without', type: 'post' }, fields: { title: 'Empty' } };
    });

    const next: Config = {
      ...prev,
      collections: {
        post: { ...prev.collections.post, fields: { title: prev.collections.post.fields.title } },
      },
    };
    const result = await previewSchemaChange(next);

    expect(result.impact).toHaveLength(1);
    expect(result.impact[0].id).toBe('post-with');
    expect(result.impact[0].dataLoss).toBe(true);
  });

  it('flags renames as preserved-data when the field has a value', async () => {
    const prev: Config = {
      ...baseConfig,
      collections: {
        post: {
          label: 'Post',
          hasMany: true,
          fields: {
            title: { label: 'Title', format: 'string', entryTitle: true, required: true },
            tagline: { label: 'Tagline', format: 'string' },
          },
        },
      },
    };
    mockedFs.readFile.mockResolvedValue(JSON.stringify(prev));
    mockedFiles.getContentFiles.mockResolvedValue(['cms/content/post/post-p1.json']);
    mockedFiles.getFile.mockResolvedValue({
      sys: { id: 'p1', type: 'post' },
      fields: { title: 'Hi', tagline: 'My subtitle' },
    });

    const next: Config = {
      ...prev,
      collections: {
        post: {
          ...prev.collections.post,
          fields: {
            title: prev.collections.post.fields.title,
            subtitle: { label: 'Subtitle', format: 'string' },
          },
        },
      },
    };
    const result = await previewSchemaChange(next, { fieldRenames: { post: { tagline: 'subtitle' } } });

    expect(result.impact).toHaveLength(1);
    expect(result.impact[0].dataLoss).toBe(false);
    expect(result.impact[0].reasons.join(' ')).toMatch(/field renamed: tagline → subtitle/);
  });

  it('reports cross-collection rewrite count when a target collection is renamed', async () => {
    const prev = refConfig();
    mockedFs.readFile.mockResolvedValue(JSON.stringify(prev));
    mockedFiles.getContentFiles.mockImplementation(async (collection: string = '**') => {
      if (collection === 'author') return ['cms/content/author/author-a1.json'];
      return ['cms/content/author/author-a1.json', 'cms/content/post/post-p1.json'];
    });
    mockedFiles.getFile.mockImplementation(async (p: string) => {
      if (p.includes('/author/')) return { sys: { id: 'a1', type: 'author' }, fields: { name: 'Alice' } };
      return {
        sys: { id: 'p1', type: 'post' },
        fields: { title: 'Hi', authors: JSON.stringify(['author-a1.json']) },
      };
    });

    const next: Config = {
      ...prev,
      collections: {
        post: {
          ...prev.collections.post,
          fields: {
            ...prev.collections.post.fields,
            authors: { label: 'Authors', format: 'reference', reference: { collections: ['writer'] } },
          },
        },
        writer: prev.collections.author,
      },
    };

    const result = await previewSchemaChange(next, { collectionRenames: { author: 'writer' } });

    const postImpact = result.impact.find((i) => i.id === 'post-p1');
    expect(postImpact).toBeDefined();
    expect(postImpact?.reasons.join(' ')).toMatch(/1 reference will be rewritten/);
    expect(postImpact?.dataLoss).toBe(false);
  });

  it('populates the entry title from the entryTitle field when present', async () => {
    mockedFs.readFile.mockResolvedValue(JSON.stringify(baseConfig));
    mockedFiles.getContentFiles.mockResolvedValue(['cms/content/post/post-p1.json']);
    mockedFiles.getFile.mockResolvedValue({
      sys: { id: 'p1', type: 'post' },
      fields: { title: 'My great post' },
    });

    const next: Config = { ...baseConfig, collections: {} };
    const result = await previewSchemaChange(next);

    expect(result.impact[0].title).toBe('My great post');
  });
});

describe('saveSchema — Phase 6 cross-collection writes', () => {
  it('rewrites reference field values in unrelated collections when a target is renamed', async () => {
    const prev: Config = {
      projectName: 'Test',
      contentFolder: 'cms/content',
      mediaFolder: 'public/media',
      mediaAllowedFormats: ['png'],
      git: { baseBranch: 'main' },
      collections: {
        post: {
          label: 'Post',
          hasMany: true,
          fields: {
            title: { label: 'Title', format: 'string', entryTitle: true, required: true },
            authors: { label: 'Authors', format: 'reference', reference: { collections: ['author'] } },
          },
        },
        author: {
          label: 'Author',
          hasMany: true,
          fields: { name: { label: 'Name', format: 'string', entryTitle: true } },
        },
      },
    };
    mockedFs.readFile.mockResolvedValue(JSON.stringify(prev));
    mockedFiles.getContentFiles.mockImplementation(async (collection: string = '**') => {
      if (collection === 'author') return ['cms/content/author/author-a1.json'];
      return ['cms/content/author/author-a1.json', 'cms/content/post/post-p1.json'];
    });
    mockedFiles.getFile.mockImplementation(async (p: string) => {
      if (p.includes('/author/')) return { sys: { id: 'a1', type: 'author' }, fields: { name: 'Alice' } };
      return {
        sys: { id: 'p1', type: 'post' },
        fields: { title: 'Hi', authors: JSON.stringify(['author-a1.json']) },
      };
    });

    const next: Config = {
      ...prev,
      collections: {
        post: {
          ...prev.collections.post,
          fields: {
            ...prev.collections.post.fields,
            authors: { label: 'Authors', format: 'reference', reference: { collections: ['writer'] } },
          },
        },
        writer: prev.collections.author,
      },
    };

    const result = await saveSchema(next, { collectionRenames: { author: 'writer' } });
    if (!result.success) throw new Error(`saveSchema failed: ${result.error}`);

    const writes = mockedFs.writeFile.mock.calls
      .map((c) => ({ path: String(c[0]), content: String(c[1]) }))
      .filter((c) => c.path.endsWith('cms/content/post/post-p1.json'));
    expect(writes).toHaveLength(1);
    const parsed = JSON.parse(writes[0].content);
    expect(parsed.fields.authors).toBe(JSON.stringify(['writer-a1.json']));
  });

  it('prunes orphaned reference keys without removing the field when only one allowed target is dropped', async () => {
    const prev: Config = {
      projectName: 'Test',
      contentFolder: 'cms/content',
      mediaFolder: 'public/media',
      mediaAllowedFormats: ['png'],
      git: { baseBranch: 'main' },
      collections: {
        post: {
          label: 'Post',
          hasMany: true,
          fields: {
            title: { label: 'Title', format: 'string', entryTitle: true, required: true },
            people: {
              label: 'People',
              format: 'reference',
              reference: { collections: ['author', 'editor'] },
            },
          },
        },
        author: {
          label: 'Author',
          hasMany: true,
          fields: { name: { label: 'Name', format: 'string', entryTitle: true } },
        },
        editor: {
          label: 'Editor',
          hasMany: true,
          fields: { name: { label: 'Name', format: 'string', entryTitle: true } },
        },
      },
    };
    mockedFs.readFile.mockResolvedValue(JSON.stringify(prev));
    mockedFiles.getContentFiles.mockImplementation(async (collection: string = '**') => {
      if (collection === 'editor') return ['cms/content/editor/editor-e1.json'];
      return [
        'cms/content/author/author-a1.json',
        'cms/content/editor/editor-e1.json',
        'cms/content/post/post-p1.json',
      ];
    });
    mockedFiles.getFile.mockImplementation(async (p: string) => {
      if (p.includes('/author/')) return { sys: { id: 'a1', type: 'author' }, fields: { name: 'Alice' } };
      if (p.includes('/editor/')) return { sys: { id: 'e1', type: 'editor' }, fields: { name: 'Erin' } };
      return {
        sys: { id: 'p1', type: 'post' },
        fields: {
          title: 'Hi',
          people: JSON.stringify(['author-a1.json', 'editor-e1.json']),
        },
      };
    });

    // Drop the `editor` collection; tighten `people.reference.collections` to
    // the surviving `['author']` so validation passes.
    const next: Config = {
      ...prev,
      collections: {
        post: {
          ...prev.collections.post,
          fields: {
            ...prev.collections.post.fields,
            people: { label: 'People', format: 'reference', reference: { collections: ['author'] } },
          },
        },
        author: prev.collections.author,
      },
    };

    const result = await saveSchema(next);
    if (!result.success) throw new Error(`saveSchema failed: ${result.error}`);

    const writes = mockedFs.writeFile.mock.calls
      .map((c) => ({ path: String(c[0]), content: String(c[1]) }))
      .filter((c) => c.path.endsWith('cms/content/post/post-p1.json'));
    expect(writes).toHaveLength(1);
    const parsed = JSON.parse(writes[0].content);
    expect(parsed.fields.people).toBe(JSON.stringify(['author-a1.json']));
  });
});

// ---------------------------------------------------------------------------
// saveSchema
// ---------------------------------------------------------------------------

describe('saveSchema', () => {
  it('returns an error when validateConfig throws', async () => {
    mockedFs.readFile.mockResolvedValue(JSON.stringify(baseConfig));

    const result = await saveSchema({
      ...baseConfig,
      collections: { broken: { label: 'Broken', fields: {} } },
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/at least one field/);
    expect(mockedBuild.buildJsons).not.toHaveBeenCalled();
  });

  it('writes regenerated artifacts to disk in dev mode and busts caches', async () => {
    mockedFs.readFile.mockResolvedValue(JSON.stringify(baseConfig));
    mockedFiles.getContentFiles.mockResolvedValue([]);

    const next: Config = {
      ...baseConfig,
      collections: {
        ...baseConfig.collections,
        author: {
          label: 'Author',
          hasMany: true,
          fields: { name: { label: 'Name', format: 'string', entryTitle: true } },
        },
      },
    };

    const result = await saveSchema(next);

    expect(result.success).toBe(true);

    // Schema artifacts written to fs (12 files from regenerateAll)
    const writtenPaths = mockedFs.writeFile.mock.calls.map((c) => String(c[0]));
    expect(writtenPaths.some((p) => p.endsWith('cms/schema.json'))).toBe(true);
    expect(writtenPaths.some((p) => p.endsWith('cms/__generated__/types.ts'))).toBe(true);
    expect(writtenPaths.some((p) => p.endsWith('octocms/docs/schema.md'))).toBe(true);

    // No GitHub commit in dev
    expect(mockedGithub.commitMultipleFilesToGitHub).not.toHaveBeenCalled();

    // Cache bust
    expect(mockedBuild.buildJsons).toHaveBeenCalledWith('');
  });

  it('commits a single GitHub batch in production', async () => {
    mockedGithub.isProductionMode.mockReturnValue(true);
    mockedGithub.getGitHubFile.mockImplementation(async (path: string) => {
      if (path === 'cms/schema.json') return { content: JSON.stringify(baseConfig), sha: 'abc' };
      return null;
    });
    mockedFiles.getContentFiles.mockResolvedValue([]);

    const next: Config = {
      ...baseConfig,
      collections: {
        ...baseConfig.collections,
        author: {
          label: 'Author',
          hasMany: true,
          fields: { name: { label: 'Name', format: 'string', entryTitle: true } },
        },
      },
    };

    const result = await saveSchema(next);

    expect(result.success).toBe(true);
    expect(mockedFiles.assertFeatureBranchForWritesIfRequired).toHaveBeenCalled();
    expect(mockedGithub.commitMultipleFilesToGitHub).toHaveBeenCalledTimes(1);

    const [batch, message, branch] = mockedGithub.commitMultipleFilesToGitHub.mock.calls[0];
    expect(branch).toBe('cms/edits');
    expect(message).toMatch(/update schema/);
    const paths = batch.map((c) => c.path);
    expect(paths).toContain('cms/schema.json');
    expect(paths).toContain('cms/__generated__/types.ts');
    expect(paths).toContain('octocms/docs/schema.md');
    // Every change is an upsert-text since no entries were affected.
    expect(batch.every((c) => c.kind === 'upsert-text')).toBe(true);

    expect(mockedBuild.buildJsons).toHaveBeenCalledWith('');
  });

  it('queues a delete and skips a write for entries in a removed collection (dev mode)', async () => {
    const prev: Config = {
      ...baseConfig,
      collections: {
        ...baseConfig.collections,
        legacy: {
          label: 'Legacy',
          hasMany: true,
          fields: { title: { label: 'Title', format: 'string', entryTitle: true } },
        },
      },
    };
    mockedFs.readFile.mockResolvedValue(JSON.stringify(prev));
    mockedFiles.getContentFiles.mockImplementation(async (collection: string = '**') => {
      if (collection === 'legacy') return ['cms/content/legacy/legacy-l1.json'];
      return [];
    });
    mockedFiles.getFile.mockResolvedValue({
      sys: { id: 'l1', type: 'legacy', status: 'merged' },
      fields: { title: 'Old' },
    });

    const result = await saveSchema(baseConfig);

    expect(result.success).toBe(true);
    const removedPaths = mockedFs.rm.mock.calls.map((c) => String(c[0]));
    expect(removedPaths.some((p) => p.endsWith('cms/content/legacy/legacy-l1.json'))).toBe(true);
  });

  it('renames the entry file when its collection is renamed', async () => {
    const prev: Config = {
      ...baseConfig,
      collections: {
        post: {
          label: 'Post',
          hasMany: true,
          fields: { title: { label: 'Title', format: 'string', entryTitle: true } },
        },
      },
    };
    mockedFs.readFile.mockResolvedValue(JSON.stringify(prev));
    mockedFiles.getContentFiles.mockImplementation(async (collection: string = '**') => {
      if (collection === 'post') return ['cms/content/post/post-p1.json'];
      return [];
    });
    mockedFiles.getFile.mockResolvedValue({
      sys: { id: 'p1', type: 'post', status: 'merged' },
      fields: { title: 'Hi' },
    });

    const next: Config = {
      ...baseConfig,
      collections: {
        article: {
          label: 'Article',
          hasMany: true,
          fields: { title: { label: 'Title', format: 'string', entryTitle: true } },
        },
      },
    };

    const result = await saveSchema(next, { collectionRenames: { post: 'article' } });

    expect(result.success).toBe(true);
    // Old file deleted
    const removedPaths = mockedFs.rm.mock.calls.map((c) => String(c[0]));
    expect(removedPaths.some((p) => p.endsWith('cms/content/post/post-p1.json'))).toBe(true);
    // New file written
    const writtenPaths = mockedFs.writeFile.mock.calls.map((c) => String(c[0]));
    expect(writtenPaths.some((p) => p.endsWith('cms/content/article/article-p1.json'))).toBe(true);
  });

  it('returns the buildJsons error when cache invalidation fails', async () => {
    mockedFs.readFile.mockResolvedValue(JSON.stringify(baseConfig));
    mockedFiles.getContentFiles.mockResolvedValue([]);
    mockedBuild.buildJsons.mockResolvedValueOnce({ success: false, error: 'cache bust failed' });

    const result = await saveSchema(baseConfig);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('cache bust failed');
  });
});

// ---------------------------------------------------------------------------
// Phase 4: create / rename / delete content type integration paths
// ---------------------------------------------------------------------------

describe('saveSchema — create/rename/delete content types (Phase 4)', () => {
  it('creates a brand-new content type with a single default field', async () => {
    mockedFs.readFile.mockResolvedValue(JSON.stringify(baseConfig));
    mockedFiles.getContentFiles.mockResolvedValue([]);

    const next: Config = {
      ...baseConfig,
      collections: {
        ...baseConfig.collections,
        recipe: {
          label: 'Recipe',
          hasMany: true,
          fields: {
            title: { label: 'Title', format: 'string', entryTitle: true, required: true },
          },
        },
      },
    };

    const result = await saveSchema(next, { message: 'CMS: create content type recipe' });

    expect(result.success).toBe(true);
    // schema.json contains the new collection
    const schemaWrite = mockedFs.writeFile.mock.calls.find((c) => String(c[0]).endsWith('cms/schema.json'));
    expect(schemaWrite).toBeDefined();
    const schemaContent = JSON.parse(String(schemaWrite![1]));
    expect(schemaContent.collections.recipe).toBeDefined();
    expect(schemaContent.collections.recipe.fields.title.entryTitle).toBe(true);
  });

  it('rejects creating a content type with zero fields', async () => {
    mockedFs.readFile.mockResolvedValue(JSON.stringify(baseConfig));

    const result = await saveSchema({
      ...baseConfig,
      collections: { ...baseConfig.collections, empty: { label: 'Empty', fields: {} } },
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/at least one field/);
  });

  it('renames a content type — moves entries and companion files in a single batch (prod)', async () => {
    const prev: Config = {
      ...baseConfig,
      collections: {
        post: {
          label: 'Post',
          hasMany: true,
          fields: {
            title: { label: 'Title', format: 'string', entryTitle: true, required: true },
            body: { label: 'Body', format: 'markdown' },
          },
        },
      },
    };
    mockedGithub.isProductionMode.mockReturnValue(true);
    mockedGithub.getGitHubFile.mockImplementation(async (path: string) => {
      if (path === 'cms/schema.json') return { content: JSON.stringify(prev), sha: 'abc' };
      if (path === 'cms/content/post/post-p1.body.md') return { content: '# Hello', sha: 'md1' };
      return null;
    });
    mockedFiles.getContentFiles.mockImplementation(async (collection: string = '**') => {
      if (collection === 'post') return ['cms/content/post/post-p1.json'];
      return [];
    });
    mockedFiles.getFile.mockResolvedValue({
      sys: { id: 'p1', type: 'post', status: 'merged' },
      fields: { title: 'Hello' },
    });

    const next: Config = {
      ...baseConfig,
      collections: {
        article: {
          label: 'Article',
          hasMany: true,
          fields: {
            title: { label: 'Title', format: 'string', entryTitle: true, required: true },
            body: { label: 'Body', format: 'markdown' },
          },
        },
      },
    };

    const result = await saveSchema(next, { collectionRenames: { post: 'article' } });
    expect(result.success).toBe(true);

    expect(mockedGithub.commitMultipleFilesToGitHub).toHaveBeenCalledTimes(1);
    const [batch] = mockedGithub.commitMultipleFilesToGitHub.mock.calls[0];
    const paths = batch.map((c) => `${c.kind}:${c.path}`);

    expect(paths).toContain('delete:cms/content/post/post-p1.json');
    expect(paths).toContain('upsert-text:cms/content/article/article-p1.json');
    // companion file moves
    expect(paths).toContain('delete:cms/content/post/post-p1.body.md');
    expect(paths).toContain('upsert-text:cms/content/article/article-p1.body.md');
    // The companion content was carried over verbatim
    const newCompanion = batch.find(
      (c) => c.kind === 'upsert-text' && c.path === 'cms/content/article/article-p1.body.md',
    );
    expect(newCompanion && 'content' in newCompanion ? newCompanion.content : '').toBe('# Hello');
  });

  it('deletes a content type — removes its entries and companion files', async () => {
    const prev: Config = {
      ...baseConfig,
      collections: {
        ...baseConfig.collections,
        legacy: {
          label: 'Legacy',
          hasMany: true,
          fields: {
            title: { label: 'Title', format: 'string', entryTitle: true, required: true },
            body: { label: 'Body', format: 'markdown' },
          },
        },
      },
    };
    mockedFs.readFile.mockResolvedValue(JSON.stringify(prev));
    mockedFiles.getContentFiles.mockImplementation(async (collection: string = '**') => {
      if (collection === 'legacy') return ['cms/content/legacy/legacy-l1.json'];
      return [];
    });
    mockedFiles.getFile.mockResolvedValue({
      sys: { id: 'l1', type: 'legacy', status: 'merged' },
      fields: { title: 'Old' },
    });

    const result = await saveSchema(baseConfig);
    expect(result.success).toBe(true);

    const removed = mockedFs.rm.mock.calls.map((c) => String(c[0]));
    expect(removed.some((p) => p.endsWith('cms/content/legacy/legacy-l1.json'))).toBe(true);
    // companion .md is best-effort deleted in dev mode
    expect(removed.some((p) => p.endsWith('cms/content/legacy/legacy-l1.body.md'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 4: previewSchemaChange surface for cardinality + create flows
// ---------------------------------------------------------------------------

describe('previewSchemaChange — Phase 4 flows', () => {
  it('reports a collection-added change with no impact', async () => {
    mockedFs.readFile.mockResolvedValue(JSON.stringify(baseConfig));
    mockedFiles.getContentFiles.mockResolvedValue([]);

    const next: Config = {
      ...baseConfig,
      collections: {
        ...baseConfig.collections,
        recipe: {
          label: 'Recipe',
          hasMany: true,
          fields: {
            title: { label: 'Title', format: 'string', entryTitle: true, required: true },
          },
        },
      },
    };
    const result = await previewSchemaChange(next);

    expect(result.valid).toBe(true);
    expect(result.changes).toContainEqual({ kind: 'collection-added', collection: 'recipe' });
    expect(result.impact).toEqual([]);
  });

  it('reports a hasMany change without listing impact (no per-entry migration needed)', async () => {
    mockedFs.readFile.mockResolvedValue(JSON.stringify(baseConfig));
    mockedFiles.getContentFiles.mockResolvedValue([]);

    const next: Config = {
      ...baseConfig,
      collections: {
        post: { ...baseConfig.collections.post, hasMany: false },
      },
    };
    const result = await previewSchemaChange(next);

    expect(result.changes).toContainEqual({
      kind: 'collection-hasMany-changed',
      collection: 'post',
      from: true,
      to: false,
    });
    expect(result.impact).toEqual([]);
  });
});
