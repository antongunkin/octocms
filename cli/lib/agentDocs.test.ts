import { describe, expect, it } from 'vitest';
import type { CollectionField, Config } from '../../types';
import { generateAgentIndex, generateAgentOverview, generateAgentSchema, placeholderValue } from './agentDocs';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const minimalConfig: Config = {
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
        slug: { label: 'Slug', format: 'slug', required: true },
        body: { label: 'Body', format: 'markdown' },
      },
    },
  },
};

const richConfig: Config = {
  projectName: 'Full',
  contentFolder: 'cms/content',
  mediaFolder: 'public/media',
  mediaAllowedFormats: ['png', 'jpg'],
  git: { baseBranch: 'main' },
  collections: {
    post: {
      label: 'Post',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', entryTitle: true, required: true },
        slug: { label: 'Slug', format: 'slug', required: true },
        publishedAt: { label: 'Published', format: 'datetime' },
        featuredImage: { label: 'Image', format: 'image' },
        body: { label: 'Body', format: 'markdown' },
        tags: { label: 'Tags', format: 'string', list: true },
        meta: { label: 'Meta', format: 'json' },
        enabled: { label: 'Enabled', format: 'boolean' },
        category: {
          label: 'Category',
          format: 'select',
          options: [
            { label: 'General', value: 'general' },
            { label: 'Featured', value: 'featured' },
          ],
          defaultOption: 'general',
        },
      },
    },
    homePage: {
      label: 'Home Page',
      fields: {
        title: { label: 'Title', format: 'string', entryTitle: true },
        freeform: { label: 'Rich Text', format: 'richtext' },
      },
    },
    author: {
      label: 'Author',
      hasMany: true,
      fields: {
        name: { label: 'Name', format: 'string', entryTitle: true },
        posts: {
          label: 'Posts',
          format: 'reference',
          reference: { collections: ['post'], cardinality: 'many' },
        },
      },
    },
  },
  search: {
    publicCollections: {
      post: { urlPattern: '/blog/:slug' },
    },
  },
};

const collections = ['post'] as const;
const richCollections = ['post', 'homePage', 'author'] as const;

// ---------------------------------------------------------------------------
// placeholderValue
// ---------------------------------------------------------------------------

describe('placeholderValue', () => {
  it('string → quoted text', () => {
    const f: CollectionField = { label: 'Title', format: 'string' };
    expect(placeholderValue(f, collections)).toBe('"Example title"');
  });

  it('string list → array', () => {
    const f: CollectionField = { label: 'Tags', format: 'string', list: true };
    expect(placeholderValue(f, collections)).toBe('["tag1", "tag2"]');
  });

  it('slug → example slug', () => {
    const f: CollectionField = { label: 'Slug', format: 'slug' };
    expect(placeholderValue(f, collections)).toBe('"example-slug"');
  });

  it('boolean → "true"', () => {
    const f: CollectionField = { label: 'Enabled', format: 'boolean' };
    expect(placeholderValue(f, collections)).toBe('"true"');
  });

  it('number → 0', () => {
    const f: CollectionField = { label: 'Count', format: 'number' };
    expect(placeholderValue(f, collections)).toBe('0');
  });

  it('datetime → ISO string', () => {
    const f: CollectionField = { label: 'Date', format: 'datetime' };
    expect(placeholderValue(f, collections)).toBe('"2024-01-01T00:00:00.000Z"');
  });

  it('image → UUID placeholder', () => {
    const f: CollectionField = { label: 'Image', format: 'image' };
    expect(placeholderValue(f, collections)).toBe('"<media-entry-uuid>"');
  });

  it('json → null', () => {
    const f: CollectionField = { label: 'Data', format: 'json' };
    expect(placeholderValue(f, collections)).toBe('null');
  });

  it('markdown → companion note', () => {
    const f: CollectionField = { label: 'Body', format: 'markdown' };
    expect(placeholderValue(f, collections)).toContain('companion .md file');
  });

  it('richtext → companion note', () => {
    const f: CollectionField = { label: 'Content', format: 'richtext' };
    expect(placeholderValue(f, collections)).toContain('companion .mdx file');
  });

  it('select single → first option', () => {
    const f: CollectionField = {
      label: 'Cat',
      format: 'select',
      options: [
        { label: 'A', value: 'alpha' },
        { label: 'B', value: 'beta' },
      ],
    };
    expect(placeholderValue(f, collections)).toBe('"alpha"');
  });

  it('select multiple → array with first option', () => {
    const f: CollectionField = {
      label: 'Tags',
      format: 'select',
      multiple: true,
      options: [
        { label: 'A', value: 'alpha' },
        { label: 'B', value: 'beta' },
      ],
    };
    expect(placeholderValue(f, collections)).toBe('["alpha"]');
  });

  it('reference many → array with key', () => {
    const f: CollectionField = {
      label: 'Posts',
      format: 'reference',
      reference: { collections: ['post'], cardinality: 'many' },
    };
    expect(placeholderValue(f, collections)).toBe('["post-<id>.json"]');
  });

  it('reference one → single key', () => {
    const f: CollectionField = {
      label: 'Author',
      format: 'reference',
      reference: { collections: ['author'], cardinality: 'one' },
    };
    expect(placeholderValue(f, collections)).toBe('"author-<id>.json"');
  });

  it('url → example URL', () => {
    const f: CollectionField = { label: 'Website', format: 'url' };
    expect(placeholderValue(f, collections)).toBe('"https://example.com"');
  });

  it('color → hex', () => {
    const f: CollectionField = { label: 'Color', format: 'color' };
    expect(placeholderValue(f, collections)).toBe('"#000000"');
  });

  it('text → quoted text', () => {
    const f: CollectionField = { label: 'Description', format: 'text' };
    expect(placeholderValue(f, collections)).toContain('Example');
  });
});

// ---------------------------------------------------------------------------
// generateAgentOverview
// ---------------------------------------------------------------------------

describe('generateAgentOverview', () => {
  it('includes banner', () => {
    const out = generateAgentOverview(minimalConfig, collections);
    expect(out).toContain('AUTO-GENERATED');
  });

  it('includes title', () => {
    const out = generateAgentOverview(minimalConfig, collections);
    expect(out).toContain('# OctoCMS — Content Management for AI Agents');
  });

  it('includes content folder path', () => {
    const out = generateAgentOverview(minimalConfig, collections);
    expect(out).toContain('cms/content/');
  });

  it('includes entry JSON structure', () => {
    const out = generateAgentOverview(minimalConfig, collections);
    expect(out).toContain('"sys"');
    expect(out).toContain('"fields"');
  });

  it('includes status table', () => {
    const out = generateAgentOverview(minimalConfig, collections);
    expect(out).toContain('`draft`');
    expect(out).toContain('`published`');
    expect(out).toContain('`archived`');
  });

  it('includes companion file section when markdown fields exist', () => {
    const out = generateAgentOverview(minimalConfig, collections);
    expect(out).toContain('Companion files');
    expect(out).toContain('.body.md');
  });

  it('omits companion section when no markdown/richtext fields', () => {
    const noCompanionConfig: Config = {
      ...minimalConfig,
      collections: {
        simple: {
          label: 'Simple',
          hasMany: true,
          fields: { title: { label: 'Title', format: 'string' } },
        },
      },
    };
    const out = generateAgentOverview(noCompanionConfig, ['simple']);
    expect(out).not.toContain('Companion files');
  });

  it('includes URL mapping table when search config exists', () => {
    const out = generateAgentOverview(richConfig, richCollections);
    expect(out).toContain('URL to collection mapping');
    expect(out).toContain('/blog/:slug');
    expect(out).toContain('`post`');
  });

  it('omits URL mapping when no search config', () => {
    const out = generateAgentOverview(minimalConfig, collections);
    expect(out).not.toContain('URL to collection mapping');
  });

  it('includes collections summary table', () => {
    const out = generateAgentOverview(richConfig, richCollections);
    expect(out).toContain('| `post` |');
    expect(out).toContain('| `homePage` |');
    expect(out).toContain('hasMany');
    expect(out).toContain('singleton');
  });

  it('includes CRUD sections', () => {
    const out = generateAgentOverview(minimalConfig, collections);
    expect(out).toContain('## Creating a new entry');
    expect(out).toContain('## Updating an entry');
    expect(out).toContain('## Deleting an entry');
  });

  it('includes add collection section', () => {
    const out = generateAgentOverview(minimalConfig, collections);
    expect(out).toContain('## Adding a new collection');
    expect(out).toContain('cms/schema.json');
    expect(out).toContain("query('collectionName')");
  });

  it('points readers at editing-schema.md as the source of truth', () => {
    const out = generateAgentOverview(minimalConfig, collections);
    expect(out).toContain('## Where the schema lives');
    expect(out).toContain('editing-schema.md');
  });
});

// ---------------------------------------------------------------------------
// generateAgentSchema
// ---------------------------------------------------------------------------

describe('generateAgentSchema', () => {
  it('includes banner', () => {
    const out = generateAgentSchema(minimalConfig, collections);
    expect(out).toContain('AUTO-GENERATED');
  });

  it('includes collection heading', () => {
    const out = generateAgentSchema(minimalConfig, collections);
    expect(out).toContain('## Post (`post`)');
  });

  it('shows hasMany type', () => {
    const out = generateAgentSchema(richConfig, richCollections);
    expect(out).toContain('hasMany (multiple entries)');
  });

  it('shows singleton type', () => {
    const out = generateAgentSchema(richConfig, richCollections);
    expect(out).toContain('singleton');
  });

  it('includes field table with columns', () => {
    const out = generateAgentSchema(minimalConfig, collections);
    expect(out).toContain('| Field | Label | Format | Required | Storage notes |');
    expect(out).toContain('| `title` |');
    expect(out).toContain('| `slug` |');
  });

  it('marks required fields', () => {
    const out = generateAgentSchema(minimalConfig, collections);
    expect(out).toMatch(/\| `title` .+\| yes \|/);
  });

  it('includes example JSON with sys and fields', () => {
    const out = generateAgentSchema(minimalConfig, collections);
    expect(out).toContain('"type": "post"');
    expect(out).toContain('"status": "draft"');
    expect(out).toContain('"title":');
    expect(out).toContain('"slug":');
  });

  it('omits markdown fields from example JSON', () => {
    const out = generateAgentSchema(minimalConfig, collections);
    // body is markdown — should NOT be in the JSON block
    expect(out).not.toMatch(/"body".*"Example/);
  });

  it('includes companion file example for markdown fields', () => {
    const out = generateAgentSchema(minimalConfig, collections);
    expect(out).toContain('post-<uuid>.body.md');
  });

  it('includes companion file example for richtext fields', () => {
    const out = generateAgentSchema(richConfig, richCollections);
    expect(out).toContain('homePage-0000.freeform.mdx');
  });

  it('shows singleton fixed ID in example', () => {
    const out = generateAgentSchema(richConfig, richCollections);
    expect(out).toContain('"id": "0000"');
  });

  it('shows UUID placeholder for hasMany', () => {
    const out = generateAgentSchema(minimalConfig, collections);
    expect(out).toContain('"id": "<uuid>"');
  });

  it('includes select options in storage notes', () => {
    const out = generateAgentSchema(richConfig, richCollections);
    expect(out).toContain('`general`');
    expect(out).toContain('`featured`');
    expect(out).toContain('Default: `general`');
  });

  it('includes reference collection info', () => {
    const out = generateAgentSchema(richConfig, richCollections);
    expect(out).toContain('Collections: `post`');
    expect(out).toContain('Cardinality: `many`');
  });

  it('includes field format storage reference table', () => {
    const out = generateAgentSchema(minimalConfig, collections);
    expect(out).toContain('## Field format storage reference');
    expect(out).toContain('| `string` |');
    expect(out).toContain('| `boolean` |');
    expect(out).toContain('| `reference` |');
  });

  it('includes number field constraints', () => {
    const numConfig: Config = {
      ...minimalConfig,
      collections: {
        item: {
          label: 'Item',
          hasMany: true,
          fields: {
            sort: { label: 'Sort', format: 'number', min: 0, max: 100, valueType: 'int' },
          },
        },
      },
    };
    const out = generateAgentSchema(numConfig, ['item']);
    expect(out).toContain('min: 0');
    expect(out).toContain('max: 100');
    expect(out).toContain('type: int');
  });
});

// ---------------------------------------------------------------------------
// generateAgentIndex
// ---------------------------------------------------------------------------

describe('generateAgentIndex', () => {
  it('includes banner', () => {
    const out = generateAgentIndex();
    expect(out).toContain('AUTO-GENERATED');
  });

  it('includes links to overview and schema', () => {
    const out = generateAgentIndex();
    expect(out).toContain('./overview.md');
    expect(out).toContain('./schema.md');
  });

  it('includes AGENTS.md usage instructions', () => {
    const out = generateAgentIndex();
    expect(out).toContain('AGENTS.md');
  });

  it('includes regeneration command', () => {
    const out = generateAgentIndex();
    expect(out).toContain('npm run agent-docs:gen');
  });
});
