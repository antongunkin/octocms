/**
 * Side-effect hook used by save/new/remove server actions to keep
 * `cms/__generated__/embeddings.json` in sync with content writes.
 *
 * Best-effort by design — when the agent is disabled, the optional peer dep
 * is missing, or the embedder fails for any reason, the helper logs a warning
 * and returns silently. The primary content commit still succeeds; running
 * `embeddings:gen` in CI is the safety net that repairs drift.
 *
 * The hook itself is responsible for *persisting* the updated store. In
 * production this is a separate single-file commit (kept simple to avoid
 * refactoring the multi-step save flow); in dev it's a local FS write. When
 * we later move to atomic batched commits this module is the single seam to
 * change.
 */

/* eslint-disable no-console */

import { promises as fsPromises } from 'fs';
import path from 'path';

import type { Config } from '../types';
import type { AgentConfig } from './types';
import { isAgentEnabled } from './featureFlag';
import {
  EMBEDDINGS_STORE_PATH,
  embedEntryFromMemory,
  emptyStore,
  loadEmbeddings,
  removeEntryFromStore,
  serializeStore,
  upsertEntryInStore,
  type EmbeddingsStore,
} from './embeddings';

function normalizeContentPath(p: string): string {
  return p.replace(/\\/g, '/');
}

async function persistStore(
  serialized: string,
  branch: string | undefined,
  message: string,
  isProduction: boolean,
): Promise<void> {
  if (isProduction) {
    const { saveGitHubFile } = await import('../admin/github');
    await saveGitHubFile(EMBEDDINGS_STORE_PATH, serialized, message, branch);
    return;
  }
  const abs = path.join(process.cwd(), 'cms', '__generated__', 'embeddings.json');
  await fsPromises.mkdir(path.dirname(abs), { recursive: true });
  await fsPromises.writeFile(abs, serialized, 'utf8');
}

/**
 * Re-embed the given entry and persist the updated store. No-op when the
 * agent is disabled. Failures are logged and swallowed — content writes must
 * not fail because of an embedding issue.
 */
export async function syncEmbeddingsAfterUpsert(args: {
  agentConfig: AgentConfig;
  config: Config;
  entryPath: string;
  payload: { sys?: { type?: string }; fields?: Record<string, unknown> };
  companions: Record<string, string>;
  branch: string | undefined;
  isProduction: boolean;
}): Promise<void> {
  const { agentConfig, entryPath, payload, companions, branch, isProduction } = args;
  if (!isAgentEnabled(agentConfig)) return;

  try {
    const previous: EmbeddingsStore = await loadEmbeddings(branch).catch(() => emptyStore());
    const { record } = await embedEntryFromMemory(payload, companions, { store: previous });
    const next = upsertEntryInStore(previous, normalizeContentPath(entryPath), record);
    await persistStore(serializeStore(next), branch, `CMS: update embeddings for ${entryPath}`, isProduction);
  } catch (e) {
    console.warn(`[octocms/agent] embeddings sync failed for ${entryPath}: ${(e as Error).message}`);
  }
}

/**
 * Drop the entry from the store and persist. No-op when the entry isn't in
 * the store. Same best-effort semantics as `syncEmbeddingsAfterUpsert`.
 */
export async function syncEmbeddingsAfterRemove(args: {
  agentConfig: AgentConfig;
  entryPath: string;
  branch: string | undefined;
  isProduction: boolean;
}): Promise<void> {
  const { agentConfig, entryPath, branch, isProduction } = args;
  if (!isAgentEnabled(agentConfig)) return;

  try {
    const previous: EmbeddingsStore = await loadEmbeddings(branch).catch(() => emptyStore());
    const norm = normalizeContentPath(entryPath);
    if (!(norm in previous.entries)) return;
    const next = removeEntryFromStore(previous, norm);
    await persistStore(serializeStore(next), branch, `CMS: remove embeddings for ${entryPath}`, isProduction);
  } catch (e) {
    console.warn(`[octocms/agent] embeddings remove failed for ${entryPath}: ${(e as Error).message}`);
  }
}
