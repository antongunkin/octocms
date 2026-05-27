/**
 * Agent documentation generators — pure functions that produce Markdown strings
 * describing how AI agents should manage OctoCMS content.
 *
 * Project-specific output is written to `cms/__generated__/agent-docs/` by
 * `npm run agent-docs:gen` (or `npm run types:gen`, which regenerates the
 * same files along with TypeScript artifacts).
 */

import type { CollectionField, Config } from 'octocms/types';

export const AGENT_DOCS_BANNER = `<!--
  AUTO-GENERATED FILE — DO NOT EDIT.
  Generated from cms/schema.json via npm run agent-docs:gen.
  Run \`npm run agent-docs:gen\` (or \`npm run types:gen\`) to regenerate.
-->

`;

/** Return a JSON-safe placeholder value string for a field (for example entries). */
export function placeholderValue(field: CollectionField, collectionNames: readonly string[]): string {
  switch (field.format) {
    case 'string':
      return field.list ? '["tag1", "tag2"]' : `"Example ${field.label.toLowerCase()}"`;
    case 'text':
      return `"Example ${field.label.toLowerCase()} text"`;
    case 'slug':
      return '"example-slug"';
    case 'url':
      return '"https://example.com"';
    case 'color':
      return '"#000000"';
    case 'boolean':
      return '"true"';
    case 'number':
      return '0';
    case 'datetime':
      return '"2024-01-01T00:00:00.000Z"';
    case 'image':
      return '"<media-entry-uuid>"';
    case 'json':
      return 'null';
    case 'markdown':
      return '"(stored in companion .md file — omitted from JSON)"';
    case 'richtext':
      return '"(stored in companion .mdx file — omitted from JSON)"';
    case 'select':
      if (field.multiple) {
        const first = field.options[0]?.value ?? 'option';
        return `["${first}"]`;
      }
      return `"${field.options[0]?.value ?? 'option'}"`;
    case 'reference': {
      const cols = field.reference?.collections ?? (field.collection ? [field.collection] : [...collectionNames]);
      const exampleKey = `"${cols[0]}-<id>.json"`;
      const cardinality = field.reference?.cardinality ?? 'many';
      return cardinality === 'one' ? exampleKey : `[${exampleKey}]`;
    }
    case 'conditional':
      return '{}';
    default:
      return '"unknown"';
  }
}

/** Return a short description of how a field format is stored in JSON. */
function formatStorageNote(field: CollectionField): string {
  switch (field.format) {
    case 'string':
      return field.list ? 'JSON array of strings' : 'plain text';
    case 'text':
      return 'plain text';
    case 'slug':
      return 'URL-safe string';
    case 'url':
      return 'URL string (http(s):// or root-relative /)';
    case 'color':
      return '#rrggbb hex string';
    case 'boolean':
      return '`"true"` or `"false"` (string, not boolean)';
    case 'number':
      return 'JSON number or `null`';
    case 'datetime':
      return 'ISO 8601 string or `null`';
    case 'image':
      return 'media entry UUID string';
    case 'json':
      return 'any valid JSON value';
    case 'markdown':
      return 'companion `.md` file (not in JSON)';
    case 'richtext':
      return 'companion `.mdx` file (not in JSON)';
    case 'select':
      return field.multiple ? 'JSON array of option values' : 'option value string';
    case 'reference': {
      const cardinality = field.reference?.cardinality ?? 'many';
      return cardinality === 'one'
        ? 'reference key string (e.g. `type-id.json`)'
        : 'JSON array of reference key strings';
    }
    case 'conditional':
      return 'JSON object (branch-dependent)';
    default:
      return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Collections generator (project-specific)
// ---------------------------------------------------------------------------

export function generateAgentCollections(cfg: Config, collectionNames: readonly string[]): string {
  const lines: string[] = [AGENT_DOCS_BANNER + '# OctoCMS — Collections Reference for AI Agents', ''];

  lines.push(
    'Project-specific collection list and URL mapping. Generated from `cms/schema.json`.',
    '',
    'For generic content-management instructions, see `octocms/docs/overview.md`.',
    '',
  );

  lines.push('## Collections', '');
  lines.push('| Collection | Label | Type |');
  lines.push('| --- | --- | --- |');
  for (const key of collectionNames) {
    const col = cfg.collections[key];
    const kind = col.hasMany ? 'hasMany' : 'singleton';
    lines.push(`| \`${key}\` | ${col.label} | ${kind} |`);
  }
  lines.push('');

  const hasCompanion = collectionNames.some((key) => {
    const col = cfg.collections[key];
    return Object.values(col.fields).some((f) => f.format === 'markdown' || f.format === 'richtext');
  });

  if (hasCompanion) {
    lines.push('## Companion files in this project', '');
    lines.push(
      'These collections use markdown or richtext fields with companion files:',
      '',
      '| Collection | Field | Companion path pattern |',
      '| --- | --- | --- |',
    );
    for (const key of collectionNames) {
      const col = cfg.collections[key];
      const isSingleton = !col.hasMany;
      const id = isSingleton ? '0000' : '<uuid>';
      for (const [fieldName, field] of Object.entries(col.fields)) {
        if (field.format !== 'markdown' && field.format !== 'richtext') continue;
        const ext = field.format === 'markdown' ? 'md' : 'mdx';
        lines.push(
          `| \`${key}\` | \`${fieldName}\` | \`${cfg.contentFolder}/${key}/${key}-${id}.${fieldName}.${ext}\` |`,
        );
      }
    }
    lines.push('');
  }

  const publicCollections = cfg.search?.publicCollections;
  if (publicCollections && Object.keys(publicCollections).length > 0) {
    lines.push('## URL to collection mapping', '');
    lines.push('Use this table to match a public URL to its content collection and entry:');
    lines.push('');
    lines.push('| URL pattern | Collection | How to find the entry |');
    lines.push('| --- | --- | --- |');
    for (const [colName, searchCfg] of Object.entries(publicCollections)) {
      const col = cfg.collections[colName];
      if (!col) continue;
      const params = searchCfg.urlPattern.match(/:(\w+)/g)?.map((p) => p.slice(1)) ?? [];
      const findHint =
        params.length > 0
          ? `Match \`fields.${params[0]}\` from the URL segment`
          : 'Fixed path — look up the singleton entry';
      lines.push(`| \`${searchCfg.urlPattern}\` | \`${colName}\` (${col.label}) | ${findHint} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Schema generator (project-specific)
// ---------------------------------------------------------------------------

export function generateAgentSchema(cfg: Config, collectionNames: readonly string[]): string {
  const lines: string[] = [AGENT_DOCS_BANNER + '# OctoCMS — Schema Reference for AI Agents', ''];

  lines.push('Per-collection field definitions and example JSON entries.', '');

  // Field format storage reference
  lines.push('## Field format storage reference', '');
  lines.push('How each field format is stored in the JSON entry file:', '');
  lines.push('| Format | Storage |');
  lines.push('| --- | --- |');
  const formatExamples: [string, string][] = [
    ['string', 'Plain text string (or JSON array when `list: true`)'],
    ['text', 'Plain text string'],
    ['markdown', 'Companion `.md` file (not in JSON `fields`)'],
    ['richtext', 'Companion `.mdx` file (not in JSON `fields`)'],
    ['boolean', '`"true"` or `"false"` (string, not JSON boolean)'],
    ['number', 'JSON number or `null`'],
    ['datetime', 'ISO 8601 string (e.g. `"2024-01-01T00:00:00.000Z"`) or `null`'],
    ['image', 'Media entry UUID string'],
    ['json', 'Any valid JSON value'],
    ['slug', 'URL-safe string'],
    ['select', 'Option value string (or JSON array when `multiple: true`)'],
    ['url', 'URL string'],
    ['color', '`#rrggbb` hex string'],
    ['reference', 'Reference key string `"type-id.json"` (or JSON array for cardinality `many`)'],
    ['conditional', 'JSON object (structure varies by branch)'],
  ];
  for (const [fmt, desc] of formatExamples) {
    lines.push(`| \`${fmt}\` | ${desc} |`);
  }
  lines.push('');

  // Per-collection sections
  for (const key of collectionNames) {
    const col = cfg.collections[key];
    const isSingleton = !col.hasMany;

    lines.push(`## ${col.label} (\`${key}\`)`, '');
    lines.push(`- **Type:** ${isSingleton ? 'singleton' : 'hasMany (multiple entries)'}`);
    lines.push(`- **Path:** \`${cfg.contentFolder}/${key}/${key}-${isSingleton ? '0000' : '<uuid>'}.json\``);

    // Companion files
    const companionFields = Object.entries(col.fields).filter(
      ([, f]) => f.format === 'markdown' || f.format === 'richtext',
    );
    if (companionFields.length > 0) {
      const companions = companionFields
        .map(([name, f]) => `\`${key}-{id}.${name}.${f.format === 'markdown' ? 'md' : 'mdx'}\``)
        .join(', ');
      lines.push(`- **Companion files:** ${companions}`);
    }
    lines.push('');

    // Field table
    lines.push('### Fields', '');
    lines.push('| Field | Label | Format | Required | Storage notes |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const [fieldName, field] of Object.entries(col.fields)) {
      const req = field.required ? 'yes' : '—';
      const storage = formatStorageNote(field);
      let extra = '';
      if (field.format === 'select') {
        const vals = field.options.map((o) => `\`${o.value}\``).join(', ');
        extra = ` Options: ${vals}.`;
        if (field.defaultOption) extra += ` Default: \`${field.defaultOption}\`.`;
        if (field.defaultOptions?.length)
          extra += ` Defaults: ${field.defaultOptions.map((v) => `\`${v}\``).join(', ')}.`;
      }
      if (field.format === 'reference') {
        const cols = field.reference?.collections ?? (field.collection ? [field.collection] : [...collectionNames]);
        extra = ` Collections: ${cols.map((c) => `\`${c}\``).join(', ')}.`;
        const card = field.reference?.cardinality ?? 'many';
        extra += ` Cardinality: \`${card}\`.`;
      }
      if (field.format === 'number') {
        const parts: string[] = [];
        if (field.min != null) parts.push(`min: ${field.min}`);
        if (field.max != null) parts.push(`max: ${field.max}`);
        if (field.valueType) parts.push(`type: ${field.valueType}`);
        if (parts.length) extra = ` ${parts.join(', ')}.`;
      }
      lines.push(`| \`${fieldName}\` | ${field.label} | \`${field.format}\` | ${req} | ${storage}${extra} |`);
    }
    lines.push('');

    // Example JSON
    lines.push('### Example entry JSON', '');
    lines.push('```json');
    lines.push('{');
    lines.push('  "sys": {');
    lines.push(`    "id": "${isSingleton ? '0000' : '<uuid>'}",`);
    lines.push(`    "type": "${key}",`);
    lines.push('    "status": "draft"');
    lines.push('  },');
    lines.push('  "fields": {');
    const jsonFields = Object.entries(col.fields).filter(([, f]) => f.format !== 'markdown' && f.format !== 'richtext');
    jsonFields.forEach(([fieldName, field], i) => {
      const val = placeholderValue(field, collectionNames);
      const comma = i < jsonFields.length - 1 ? ',' : '';
      lines.push(`    "${fieldName}": ${val}${comma}`);
    });
    lines.push('  }');
    lines.push('}');
    lines.push('```');
    lines.push('');

    // Companion file examples
    if (companionFields.length > 0) {
      for (const [fieldName, field] of companionFields) {
        const ext = field.format === 'markdown' ? 'md' : 'mdx';
        const id = isSingleton ? '0000' : '<uuid>';
        lines.push(`Companion file \`${cfg.contentFolder}/${key}/${key}-${id}.${fieldName}.${ext}\`:`, '');
        if (field.format === 'markdown') {
          lines.push('```markdown');
          lines.push(`# Example ${field.label}`);
          lines.push('');
          lines.push(`Write your ${field.label.toLowerCase()} content here in Markdown.`);
          lines.push('```');
        } else {
          lines.push('```mdx');
          lines.push(`Write your ${field.label.toLowerCase()} content here in MDX.`);
          lines.push('```');
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Index generator (project-specific)
// ---------------------------------------------------------------------------

export function generateAgentIndex(): string {
  const lines: string[] = [AGENT_DOCS_BANNER + '# OctoCMS — Project AI Agent Documentation', ''];

  lines.push(
    'These docs are generated from this project’s `cms/schema.json`.',
    'Include them in your `AGENTS.md` or reference them directly.',
    '',
    '## Project docs (auto-generated)',
    '',
    '- **[Schema Reference](./schema.md)** — Per-collection field definitions, example JSON, and file path conventions',
    '- **[Collections](./collections.md)** — Collection list, companion-file paths, and URL mapping',
    '',
    '## Package docs (stable, content-agnostic)',
    '',
    '- **`octocms/docs/overview.md`** — Generic content management (CRUD, entry shape, status values)',
    '- **`octocms/docs/editing-schema.md`** — How to edit `cms/schema.json` safely',
    '- **`octocms/docs/index.md`** — Overview of the two-tier doc model',
    '',
    '## Usage in AGENTS.md',
    '',
    "Reference these docs from your project's `AGENTS.md`:",
    '',
    '```markdown',
    '## Content Management',
    '',
    'See `octocms/docs/overview.md` for generic content operations.',
    'See `cms/__generated__/agent-docs/schema.md` for this project’s field definitions.',
    'See `cms/__generated__/agent-docs/collections.md` for collection and URL mapping.',
    'See `octocms/docs/editing-schema.md` for schema editing.',
    '```',
    '',
    'To regenerate after schema changes: `npm run agent-docs:gen` (or `npm run types:gen`)',
    '',
  );

  return lines.join('\n');
}
