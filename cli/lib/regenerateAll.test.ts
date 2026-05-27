import { describe, expect, it } from 'vitest';

import type { Config } from '../../types';
import { FIELD_FORMATS, regenerateAll } from './codegen';

const minimalConfig: Config = {
  projectName: 'Test',
  contentFolder: 'cms/content',
  mediaContentFolder: 'cms/media',
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

describe('regenerateAll', () => {
  it('produces the full set of schema-driven artifacts', () => {
    const { files } = regenerateAll(minimalConfig);
    expect(Object.keys(files).sort()).toEqual([
      'cms/__generated__/agent-docs/collections.md',
      'cms/__generated__/agent-docs/index.md',
      'cms/__generated__/agent-docs/schema.md',
      'cms/__generated__/configInit.ts',
      'cms/__generated__/content.d.ts',
      'cms/__generated__/enums.ts',
      'cms/__generated__/index.ts',
      'cms/__generated__/query.ts',
      'cms/__generated__/schema.ts',
      'cms/__generated__/types.ts',
      'cms/schema.json',
      'docs/generated/schema.md',
    ]);
  });

  it('is deterministic — same input → byte-identical output', () => {
    const a = regenerateAll(minimalConfig);
    const b = regenerateAll(minimalConfig);
    for (const path of Object.keys(a.files)) {
      expect(b.files[path]).toBe(a.files[path]);
    }
  });

  it('throws on invalid config (validateConfig is run)', () => {
    expect(() =>
      regenerateAll({
        ...minimalConfig,
        collections: { broken: { label: 'Broken', fields: {} } },
      }),
    ).toThrow(/at least one field/);
  });

  it('serialised schema.json round-trips back to the same Config shape', () => {
    const { files } = regenerateAll(minimalConfig);
    const parsed = JSON.parse(files['cms/schema.json']);
    expect(parsed).toEqual(minimalConfig);
  });

  it('FIELD_FORMATS lists every format exactly once', () => {
    expect(FIELD_FORMATS).toHaveLength(15);
    expect(new Set(FIELD_FORMATS).size).toBe(15);
  });
});
