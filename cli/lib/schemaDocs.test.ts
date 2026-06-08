import { describe, expect, it } from 'vitest';

import { generateSchemaDocs } from './schemaDocs';

describe('generateSchemaDocs', () => {
  it('documents resolved admin cache defaults from cms/schema.json', () => {
    const docs = generateSchemaDocs(
      {
        projectName: 'Test',
        contentFolder: 'cms/content',
        mediaContentFolder: 'cms/media',
        mediaFolder: 'public/media',
        mediaAllowedFormats: ['png'],
        git: { baseBranch: 'main' },
        admin: { cache: {} },
        collections: {},
      },
      [],
      [],
    );

    expect(docs).toContain('## Admin cache (from cms/schema.json)');
    expect(docs).toContain('**branchRevalidateSeconds:** `30`');
    expect(docs).toContain('**staleIfErrorSeconds:** `86400`');
  });
});
