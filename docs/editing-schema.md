# OctoCMS — Editing the Schema (for AI Agents)

This document is **hand-written** and stable across schema changes. It describes how to safely edit `cms/schema.json` directly — the source of truth for the OctoCMS data model.

The auto-generated `cms/__generated__/agent-docs/schema.md` describes the *current* schema (collections and fields). This file describes *how to edit* the schema.

Admin cache settings are documented in [admin-cache.md](./admin-cache.md).

## File location

The schema lives in **`cms/schema.json`** at the repo root. It is plain JSON, hand-editable, and the visual Content Model editor at `/cms/model` writes to the same file. Both flows go through the same validator and the same codegen.

`cms/octocms.config.ts` is **not** the source of truth. It is a thin TypeScript binding that re-exports `cms/__generated__/schema.ts` (a literal-typed mirror of `cms/schema.json`). Do not edit `cms/octocms.config.ts` or anything in `cms/__generated__/` by hand — those files are regenerated from the JSON.

## Top-level structure

```json
{
  "projectName": "My Project",
  "contentFolder": "cms/content",
  "mediaFolder": "public/media",
  "mediaAllowedFormats": ["jpg", "jpeg", "webp", "png", "avif", "gif"],
  "git": {
    "baseBranch": "main",
    "publishedPointerBranch": "cms/publish-pointer"
  },
  "collections": {
    "<collectionKey>": {
      "label": "Human label",
      "hasMany": true,
      "fields": {
        "<fieldKey>": {
          "label": "Human label",
          "format": "<format>",
          "required": true,
          "entryTitle": true,
          "hint": "Helper text shown under the input."
        }
      }
    }
  },
  "search": {
    "publicCollections": {
      "<collectionKey>": { "urlPattern": "/blog/:slug" }
    }
  }
}
```

Top-level keys:

| Key | Type | Purpose |
| --- | --- | --- |
| `projectName` | string | Shown in the admin header |
| `contentFolder` | string | Where entry JSON lives (default `cms/content`) |
| `mediaFolder` | string | Where uploaded media files live (default `public/media`) |
| `mediaAllowedFormats` | string[] | File extensions accepted by the media uploader |
| `git.baseBranch` | string | Production base branch (e.g. `main`) |
| `git.publishedPointerBranch` | string? | Optional dedicated branch holding per-build pointer files under `cms/pointers/`. Falls back to `baseBranch` when unset. |
| `collections` | object | Map of collection key → collection definition (see below) |
| `search.publicCollections` | object? | Optional URL-pattern map for collections that map to public pages |

## Collection definition

```json
"post": {
  "label": "Post",
  "hasMany": true,
  "fields": { ... }
}
```

| Key | Type | Notes |
| --- | --- | --- |
| `label` | string | Shown in the admin UI |
| `hasMany` | boolean? | `true` for collections of many entries; omit (or `false`) for singletons |
| `fields` | object | Map of field key → field definition (≥ 1 required) |

**Collection key rules:**

- Must be a valid JavaScript identifier — letters, digits, `$`, `_`, no leading digit, max 64 chars.
- Must be unique across all collections.
- Used as the file path segment (`cms/content/<key>/`) and the `sys.type` value on entries.

## Field definition

Every field has at minimum a `label` and a `format`. Every format supports the common flags:

| Common flag | Type | Notes |
| --- | --- | --- |
| `label` | string | Human label in the editor |
| `format` | string | One of the 15 formats below |
| `required` | boolean? | Editor blocks save if empty |
| `entryTitle` | boolean? | Marks this field as the entry title (exactly one per collection if any `slug` field omits `slugSource`) |
| `hint` | string? | Plain-text helper copy under the input |
| `searchable` | boolean? | Includes the field in admin search |

**Field key rules:**

- Must be a valid JavaScript identifier — letters, digits, `$`, `_`, no leading digit.
- Must be unique within the collection.

### Field formats

| `format` | Storage on disk | Format-specific options |
| --- | --- | --- |
| `string` | Plain text in `fields` (or JSON array of strings when `list: true`) | `list?: true` |
| `text` | Plain text in `fields` | `rows?: number` |
| `markdown` | Companion `.md` file (not in `fields`) | — |
| `richtext` | Companion `.mdx` file (not in `fields`) | `richtext?: { toolbar?, embeds?, templateVariables?, components? }` |
| `boolean` | `"true"` / `"false"` string | `defaultBoolean?`, `booleanLabels?` |
| `select` | Option value string (or array when `multiple: true`) | `options: { label, value }[]`, `multiple?`, `defaultOption?`, `defaultOptions?` |
| `number` | JSON number or `null` | `min?`, `max?`, `step?`, `valueType?: 'int' \| 'float'` |
| `datetime` | ISO 8601 string or `null` | `dateOnly?`, `defaultNow?` |
| `image` | Media entry UUID string | — |
| `slug` | URL-safe string | `slugSource?: <other field key>` (defaults to the entry-title field) |
| `url` | URL string (`http(s)://` or `/...`) | — |
| `color` | `#rrggbb` hex string | `allowInput?` |
| `json` | Any valid JSON value | — |
| `reference` | Reference key string `"type-id.json"` (or array when cardinality `many`) | `reference: { collections?, cardinality?, min?, max? }` |
| `conditional` | JSON object (branch-dependent) | `conditional: { branches: [...] }` |

For the *current* per-collection field shapes and example JSON, see `cms/__generated__/agent-docs/schema.md` — it is regenerated from `cms/schema.json` on every `npm run agent-docs:gen`.

## Validation invariants

`validateConfig` (in [`octocms/cli/lib/validateConfig.ts`](../cli/lib/validateConfig.ts)) is the single source of truth for what the CMS will accept. It is run by `npm run types:gen`, by the visual editor's save action, and by `npm run octocms validate`.

Rules:

1. **Collection has ≥ 1 field.** A collection with an empty `fields` object is rejected.
2. **Field key is a valid TypeScript identifier.** `^[a-zA-Z_$][a-zA-Z0-9_$]*$`.
3. **`list: true` is only valid on `format: 'string'`.** Other formats reject it.
4. **Slug fields need a source.** A `slug` field must either set `slugSource` to the key of a non-list `string` or `text` field, **or** the collection must have exactly one `entryTitle` field.
5. **Select options must be non-empty and unique.** `defaultOption` (single) / `defaultOptions` (multiple) must be drawn from the option list and must match the field's `multiple` mode.
6. **Reference targets must exist.** Every entry in `reference.collections` must name a defined collection. `reference.cardinality` is `"one"` or `"many"`.
7. **Conditional branches.** A `conditional` field must have ≥ 1 branch. Branch keys must be unique. A branch either names a `collection` (must exist) or defines inline `fields` (recursively validated).

The validator throws on the **first** invalid rule. Fix one issue at a time and re-run.

## Editing safely

Workflow for hand-edits:

1. Edit `cms/schema.json` in your editor.
2. Run **`npm run types:gen`**. This:
   - Validates the schema (`validateConfig`).
   - Regenerates `cms/__generated__/schema.ts`, `types.ts`, `enums.ts`, `content.d.ts`, `index.ts`, `query.ts`, `configInit.ts`.
   - Regenerates `cms/__generated__/agent-docs/` when you run `npm run agent-docs:gen` (also included in `npm run types:gen`).
   - Fails fast with a clear error message if a rule is violated.
3. Run **`npm run docs:gen`** to refresh `docs/generated/schema.md`.
4. Run **`npm run checks`** to verify everything is consistent (lint, typecheck, format, all generated files up-to-date, unit tests).
5. Commit `cms/schema.json` plus every regenerated file in the same commit. Production CI enforces this — `npm run types:check` and `docs:check` fail if generated files drift.

> [!IMPORTANT]
> Always commit `cms/schema.json` together with the regenerated files in `cms/__generated__/` and `docs/generated/`. CI will reject a commit where they have drifted. The visual editor (`/cms/model`) commits all of these atomically; hand-edits must run the regenerators yourself.

## Migrating existing content

When a hand-edit changes the schema in a way that affects existing entries — renaming a field, removing a collection, changing a field's format — you are responsible for migrating the entry files yourself. The visual editor handles this automatically by calling `migrateEntry` and `migrateReferences`, but `npm run types:gen` does **not** touch entry files.

Common scenarios:

| Change | What to update by hand |
| --- | --- |
| Rename a collection (`post` → `article`) | Move every file in `cms/content/post/` to `cms/content/article/`. Rename `post-<id>.json` → `article-<id>.json`. Rename companion files (`post-<id>.body.md` → `article-<id>.body.md`). Rewrite reference values in other entries (`"post-<id>.json"` → `"article-<id>.json"`). Update `reference.collections` arrays in other field definitions that named the old key. |
| Remove a collection | Delete `cms/content/<key>/` and every companion file. Prune reference values pointing at the removed collection in other entries (cardinality-`one` → `null`; cardinality-`many` → drop the entry from the array). Remove the collection key from any `reference.collections` arrays. |
| Rename a field | In every entry, rename the key under `fields`. For `markdown` / `richtext` fields, rename the companion file (`<entry>.<oldKey>.md` → `<entry>.<newKey>.md`). |
| Remove a field | Delete the key from every entry's `fields` object. For `markdown` / `richtext`, also delete the companion `.md` / `.mdx` file. |
| Change a field's format | Coerce values per-entry. Some coercions are lossy (e.g. `select` → `string` keeps the value; `markdown` → `string` cannot recover companion file content). When in doubt, prefer the visual editor — it surfaces a preview of which entries lose data. |

If the migration is non-trivial, it is usually safer to make the change through the visual editor at `/cms/model`, which runs `previewSchemaChange()` first and shows a per-entry impact list with data-loss flags before committing.

## Branch / commit semantics

Schema edits are normal Git commits. In production, the visual editor uses the active feature branch (`cms-active-branch` cookie); hand-edits use whatever branch you have checked out. A schema commit triggers a Vercel rebuild because the generated `cms/__generated__/types.ts` changes, so `query()` resumes returning fully-typed results once the build completes.

The per-build pointer files under `cms/pointers/` (and optional `CMS_BRANCH`) control which branch is served on the public site. See [`docs/multi-deploy.md`](../../docs/multi-deploy.md). It is independent of the schema — schema and content edits ride together on a feature branch and go live when you publish that branch.

## Field-format reference

For the full per-format option set and current examples, see `cms/__generated__/agent-docs/schema.md`. The static field-format catalogue and option types are encoded in [`octocms/schema/fieldFormats.ts`](../schema/fieldFormats.ts) (`FIELD_FORMAT_META`) — that registry drives both the visual editor's "Add Field" dialog and the auto-generated docs, so adding a new format means editing the registry.

## Related docs

- [`overview.md`](./overview.md) — Generic content entry management (package doc, stable).
- `cms/__generated__/agent-docs/schema.md` — Per-collection field definitions and example JSON for the **current** project schema (auto-generated).
- `cms/__generated__/agent-docs/collections.md` — Collection list and URL mapping for the **current** project (auto-generated).
- [`docs/content-model.md`](../../docs/content-model.md) — Developer-facing description of entry storage.
- [`docs/content-model-editor.md`](../../docs/content-model-editor.md) — How to use the visual editor at `/cms/model`.
- [`docs/schema-editor.md`](../../docs/schema-editor.md) — Programmatic schema editing API (`diffSchema`, `migrateEntry`, `previewSchemaChange`, `saveSchema`).
