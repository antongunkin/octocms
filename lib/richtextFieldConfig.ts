import type { CollectionField, RichTextFieldConfig } from '../admin/types';

type RichTextFieldDef = Extract<CollectionField, { format: 'richtext' }>;

/**
 * Config passed to `FormRichTextField`. Canonical shape is `field.richtext` (see `docs/richtext.md`).
 * Also accepts legacy `embeds` / `toolbar` placed directly on the field object.
 */
export function richTextEditorConfig(field: CollectionField): RichTextFieldConfig | undefined {
  if (field.format !== 'richtext') return undefined;
  const f = field as RichTextFieldDef & {
    embeds?: RichTextFieldConfig['embeds'];
    toolbar?: RichTextFieldConfig['toolbar'];
  };
  if (f.richtext) return f.richtext;
  if (f.embeds != null || f.toolbar != null) {
    return { embeds: f.embeds, toolbar: f.toolbar };
  }
  return undefined;
}
