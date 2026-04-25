import { describe, expect, it } from 'vitest';

import type { Config } from '../types';

import { buildSystemPrompt } from './systemPrompt';

const minimalConfig: Config = {
  projectName: 'Test',
  contentFolder: 'cms/content',
  collections: {
    post: {
      label: 'Posts',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', required: true, entryTitle: true },
        body: { label: 'Body', format: 'markdown' },
        author: {
          label: 'Author',
          format: 'reference',
          reference: { collections: ['author'], cardinality: 'one' },
        },
      },
    },
    author: {
      label: 'Authors',
      hasMany: true,
      fields: {
        name: { label: 'Name', format: 'string', required: true, entryTitle: true },
      },
    },
  },
} as unknown as Config;

describe('buildSystemPrompt', () => {
  it("includes today's date in YYYY-MM-DD form", () => {
    const prompt = buildSystemPrompt({ config: minimalConfig, now: new Date('2026-04-25T12:34:00Z') });
    expect(prompt).toContain("Today's date is 2026-04-25");
  });

  it('lists every collection with its fields and required markers', () => {
    const prompt = buildSystemPrompt({ config: minimalConfig });
    expect(prompt).toContain('post (many, label="Posts")');
    expect(prompt).toContain('title:string*');
    expect(prompt).toContain('body:markdown');
    expect(prompt).toContain('author (many, label="Authors")');
    expect(prompt).toContain('name:string*');
  });

  it('mentions the read-only tools by name', () => {
    const prompt = buildSystemPrompt({ config: minimalConfig });
    expect(prompt).toContain('searchContent');
    expect(prompt).toContain('listCollections');
    expect(prompt).toContain('getEntry');
  });

  it('embeds style exemplars when provided', () => {
    const prompt = buildSystemPrompt({
      config: minimalConfig,
      styleExemplars: [{ type: 'post', title: 'Hello', body: 'This is a sample body.' }],
    });
    expect(prompt).toContain('Recent posts (style reference)');
    expect(prompt).toContain('Example 1 — post: "Hello"');
    expect(prompt).toContain('This is a sample body.');
  });

  it('omits the exemplars section when none are provided', () => {
    const prompt = buildSystemPrompt({ config: minimalConfig });
    expect(prompt).not.toContain('Recent posts');
  });
});
