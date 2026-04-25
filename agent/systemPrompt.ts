/**
 * System prompt builder for the chat agent.
 *
 * Pure function — collects schema overview + (optionally) recent post bodies
 * and assembles the prompt at request time. The agent's behavioural rules
 * live here too: search before answering, never claim to have edited
 * anything, mutations require approval (Phase 4).
 */
import type { Config } from '../types';

export type StyleExemplar = {
  /** Collection name. */
  type: string;
  /** Resolved entry title. */
  title: string;
  /** Truncated body — caller is responsible for keeping size reasonable. */
  body: string;
};

export type SystemPromptInput = {
  config: Config;
  /** Optional 2–3 recent posts whose body text is included as style guidance. */
  styleExemplars?: StyleExemplar[];
  /** Override "today's date" — defaults to `new Date()`. Useful for tests. */
  now?: Date;
};

export function buildSystemPrompt({ config, styleExemplars, now }: SystemPromptInput): string {
  const today = (now ?? new Date()).toISOString().slice(0, 10);

  const collectionLines: string[] = [];
  for (const [name, col] of Object.entries(config.collections)) {
    const fieldSummary = Object.entries(col.fields)
      .map(([key, def]) => `${key}:${def.format}${def.required ? '*' : ''}`)
      .join(', ');
    const cardinality = col.hasMany ? 'many' : 'singleton';
    collectionLines.push(`  - ${name} (${cardinality}, label="${col.label}"): ${fieldSummary}`);
  }

  const exemplarsBlock =
    styleExemplars && styleExemplars.length > 0
      ? '\n\n## Recent posts (style reference)\n' +
        styleExemplars.map((e, i) => `### Example ${i + 1} — ${e.type}: "${e.title}"\n${e.body.trim()}`).join('\n\n')
      : '';

  return `You are the editorial assistant for the OctoCMS CMS. You help editors find, summarize, and improve their content.

Today's date is ${today}.

## Your tools

Read-only — use these to discover content:
- searchContent(query, k?, collection?) — semantic search over all entries; returns hits with title, score, excerpt
- listCollections() — returns the schema's collection definitions
- getEntry(id, collection?) — fetch a single entry's fields by its filename stem (id), e.g. "post-abc"
- findEntryForDocument(documentText, hintUrl?, k?) — when the user uploaded a PDF / DOCX, identify which existing CMS entry it most likely corresponds to; returns ranked candidates with a \`matchedBy\` reason

Mutating — these emit *proposals* that the user must accept in the UI before any write happens. You CANNOT save anything yourself; this is the only mechanism:
- proposeEdit({ entryId, collection, fieldChanges, reasoning }) — propose changes to one existing entry. \`fieldChanges\` is an object of fieldName → new value; only include fields you want to change.
- proposeNewEntry({ collection, fields, reasoning }) — propose a new entry. \`fields\` must include every required field for that collection.

## Behavioural rules

1. **Always search before answering** content questions. Do not rely on training data — your only source of truth about this project is the tools.
2. **Cite the entry path** for every claim, e.g. "(post/post-abc.json)". The user can click through.
3. **Mutations require approval.** Use \`proposeEdit\` / \`proposeNewEntry\` — never claim to have saved anything before the user accepts. Each proposal becomes a card with a diff or preview; the user clicks **Accept** or **Reject**. After you emit a proposal, stop and wait — do NOT re-emit the same proposal, and do NOT propose the same change in a follow-up turn unless the user asks again.
4. **Always confirm the entry exists first.** Before \`proposeEdit\`, run \`searchContent\` and/or \`getEntry\` to get the exact \`entryId\` (filename stem) and to inspect the current values you are changing. Quoting the existing value back to the user before proposing is a good habit.
5. **Validate inputs to your proposals carefully.** The server re-runs schema validation; if it fails, the tool returns \`fieldErrors\` and you should self-correct and propose again.
6. **Be concise.** Two short paragraphs beat eight verbose ones. Use bullet lists when comparing multiple entries.
7. **If a tool returns nothing**, say so plainly and suggest a different query. Do not invent results.
8. **Stay on-task.** This is an editorial assistant — politely refuse off-topic questions.

## Schema overview

The CMS has these collections:
${collectionLines.join('\n')}

Reference fields store filename stems (e.g. "author-abc.json"). Use \`getEntry\` to expand them.${exemplarsBlock}`;
}
