import { describe, expect, it, vi } from 'vitest';

import { parseRichText } from './parseRichText';
import type { RichTextNode, ResolvedImageField } from '../../types';

describe('parseRichText', () => {
  it('parses a simple paragraph', async () => {
    const doc = await parseRichText('Hello world');
    expect(doc.type).toBe('doc');
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe('paragraph');
    const p = doc.content[0] as Extract<RichTextNode, { type: 'paragraph' }>;
    expect(p.children).toHaveLength(1);
    expect(p.children[0]).toEqual({ type: 'text', value: 'Hello world' });
  });

  it('parses headings', async () => {
    const doc = await parseRichText('## Title');
    expect(doc.content).toHaveLength(1);
    const h = doc.content[0] as Extract<RichTextNode, { type: 'heading' }>;
    expect(h.type).toBe('heading');
    expect(h.level).toBe(2);
    expect(h.children[0]).toEqual({ type: 'text', value: 'Title' });
  });

  it('parses bold and italic marks', async () => {
    const doc = await parseRichText('**bold** and *italic*');
    const p = doc.content[0] as Extract<RichTextNode, { type: 'paragraph' }>;
    expect(p.children).toHaveLength(3);
    expect(p.children[0]).toEqual({ type: 'text', value: 'bold', marks: ['bold'] });
    expect(p.children[1]).toEqual({ type: 'text', value: ' and ' });
    expect(p.children[2]).toEqual({ type: 'text', value: 'italic', marks: ['italic'] });
  });

  it('parses nested bold+italic marks', async () => {
    const doc = await parseRichText('***both***');
    const p = doc.content[0] as Extract<RichTextNode, { type: 'paragraph' }>;
    expect(p.children).toHaveLength(1);
    const text = p.children[0] as Extract<RichTextNode, { type: 'text' }>;
    expect(text.type).toBe('text');
    expect(text.value).toBe('both');
    expect(text.marks).toContain('bold');
    expect(text.marks).toContain('italic');
  });

  it('parses inline code', async () => {
    const doc = await parseRichText('Use `const x`');
    const p = doc.content[0] as Extract<RichTextNode, { type: 'paragraph' }>;
    expect(p.children).toHaveLength(2);
    expect(p.children[1]).toEqual({ type: 'text', value: 'const x', marks: ['code'] });
  });

  it('parses links', async () => {
    const doc = await parseRichText('[click here](https://example.com)');
    const p = doc.content[0] as Extract<RichTextNode, { type: 'paragraph' }>;
    expect(p.children).toHaveLength(1);
    const link = p.children[0] as Extract<RichTextNode, { type: 'link' }>;
    expect(link.type).toBe('link');
    expect(link.url).toBe('https://example.com');
    expect(link.children[0]).toEqual({ type: 'text', value: 'click here' });
  });

  it('parses lists', async () => {
    const doc = await parseRichText('- item 1\n- item 2');
    expect(doc.content).toHaveLength(1);
    const list = doc.content[0] as Extract<RichTextNode, { type: 'list' }>;
    expect(list.type).toBe('list');
    expect(list.ordered).toBe(false);
    expect(list.children).toHaveLength(2);
  });

  it('parses ordered lists', async () => {
    const doc = await parseRichText('1. first\n2. second');
    const list = doc.content[0] as Extract<RichTextNode, { type: 'list' }>;
    expect(list.type).toBe('list');
    expect(list.ordered).toBe(true);
  });

  it('parses blockquotes', async () => {
    const doc = await parseRichText('> quoted text');
    expect(doc.content[0].type).toBe('blockquote');
  });

  it('parses code blocks', async () => {
    const doc = await parseRichText('```ts\nconst x = 1;\n```');
    const code = doc.content[0] as Extract<RichTextNode, { type: 'code' }>;
    expect(code.type).toBe('code');
    expect(code.lang).toBe('ts');
    expect(code.value).toBe('const x = 1;');
  });

  it('parses thematic breaks', async () => {
    const doc = await parseRichText('---');
    expect(doc.content[0].type).toBe('thematicBreak');
  });

  it('parses CmsImage and resolves via callback', async () => {
    const resolveImage = vi.fn(
      async (mediaId: string): Promise<ResolvedImageField> => ({
        src: `/media/${mediaId}.png`,
        alt: 'Test image',
        width: 800,
        height: 600,
        blurDataURL: null,
      }),
    );

    const doc = await parseRichText('<CmsImage mediaId="abc-123" />', {
      resolveImage,
    });

    expect(resolveImage).toHaveBeenCalledWith('abc-123');
    expect(doc.content).toHaveLength(1);
    const img = doc.content[0] as Extract<RichTextNode, { type: 'image' }>;
    expect(img.type).toBe('image');
    expect(img.image.src).toBe('/media/abc-123.png');
    expect(img.image.alt).toBe('Test image');
    expect(img.image.width).toBe(800);
  });

  it('produces empty image when CmsImage has no resolver', async () => {
    const doc = await parseRichText('<CmsImage mediaId="abc-123" />');
    const img = doc.content[0] as Extract<RichTextNode, { type: 'image' }>;
    expect(img.type).toBe('image');
    expect(img.image.src).toBe('');
  });

  it('parses unknown JSX tags as component nodes', async () => {
    const doc = await parseRichText('<CallToAction text="Sign up" url="/signup" />');
    const comp = doc.content[0] as Extract<RichTextNode, { type: 'component' }>;
    expect(comp.type).toBe('component');
    expect(comp.name).toBe('CallToAction');
    expect(comp.props).toEqual({ text: 'Sign up', url: '/signup' });
  });

  it('parses mixed content with text and CmsImage', async () => {
    const mdx = `Hello world

<CmsImage mediaId="img-1" />

Goodbye`;

    const resolveImage = vi.fn(
      async (): Promise<ResolvedImageField> => ({
        src: '/media/img-1.png',
        alt: 'Image',
        width: 100,
        height: 100,
        blurDataURL: null,
      }),
    );

    const doc = await parseRichText(mdx, { resolveImage });

    expect(doc.content).toHaveLength(3);
    expect(doc.content[0].type).toBe('paragraph');
    expect(doc.content[1].type).toBe('image');
    expect(doc.content[2].type).toBe('paragraph');
  });

  it('returns empty doc for empty string', async () => {
    const doc = await parseRichText('');
    expect(doc).toEqual({ type: 'doc', content: [] });
  });

  it('parses CmsVar as a variable node', async () => {
    const doc = await parseRichText('Hello <CmsVar name="user.firstName" />!');
    const p = doc.content[0] as Extract<RichTextNode, { type: 'paragraph' }>;
    expect(p.children).toHaveLength(3);
    expect(p.children[0]).toEqual({ type: 'text', value: 'Hello ' });
    expect(p.children[1]).toEqual({ type: 'variable', name: 'user.firstName' });
    expect(p.children[2]).toEqual({ type: 'text', value: '!' });
  });

  it('skips CmsVar without a name attribute', async () => {
    const doc = await parseRichText('Hello <CmsVar />!');
    const p = doc.content[0] as Extract<RichTextNode, { type: 'paragraph' }>;
    // CmsVar without name is dropped (null)
    expect(p.children).toHaveLength(2);
    expect(p.children[0]).toEqual({ type: 'text', value: 'Hello ' });
    expect(p.children[1]).toEqual({ type: 'text', value: '!' });
  });

  it('parses block-level CmsVar', async () => {
    const doc = await parseRichText('<CmsVar name="site.name" />');
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0]).toEqual({ type: 'variable', name: 'site.name' });
  });
});
