/**
 * `octocms embeddings:gen` — Generate `cms/__generated__/embeddings.json` for
 * the chat agent's retrieval index.
 *
 * Mirrors the `types:gen` pattern: loads the user's config, walks every
 * content entry on disk, embeds new/changed entries via `@huggingface/transformers`,
 * and writes the merged store atomically. Re-running on unchanged content is a
 * fast no-op (hash-keyed skip).
 */

import { mkdirSync, writeFileSync } from 'fs';
import { promises as fsPromises } from 'fs';
import { dirname, join } from 'path';

import { glob } from 'glob';

import { embedAll, EMBEDDINGS_STORE_PATH, loadEmbeddings, serializeStore } from '../../agent/embeddings';
import { log } from '../lib/logger';
import { loadCollections, loadProjectConfig } from '../lib/project';
import { validateConfig } from '../lib/validateConfig';

export async function embeddingsGenCommand(projectRoot: string): Promise<void> {
  log.header('Generate embeddings');

  const config = await loadProjectConfig(projectRoot);
  const collections = await loadCollections(projectRoot);

  log.info('Validating config...');
  try {
    validateConfig(config, collections);
  } catch (e) {
    log.error(String((e as Error).message));
    process.exitCode = 1;
    return;
  }
  log.success(`${collections.length} collections validated`);

  // Walk content folder for entry JSONs across all collections.
  log.blank();
  log.info('Discovering entries...');
  const cwdBefore = process.cwd();
  process.chdir(projectRoot);
  let paths: string[] = [];
  try {
    paths = await glob(`${config.contentFolder}/**/*.json`);
  } finally {
    process.chdir(cwdBefore);
  }
  paths = paths.map((p) => p.replace(/\\/g, '/')).sort();
  log.success(`${paths.length} entries`);

  log.blank();
  log.info('Loading existing store (if any)...');
  // loadEmbeddings reads from process.cwd() — temporarily switch so it picks
  // up the project's local store, not the CLI invocation directory.
  process.chdir(projectRoot);
  let previous;
  try {
    previous = await loadEmbeddings();
  } finally {
    process.chdir(cwdBefore);
  }
  const previousCount = Object.keys(previous.entries).length;
  log.success(`${previousCount} existing vectors`);

  log.blank();
  log.info('Embedding entries (model loads on first run; ~3–10s cold)...');
  let lastDone = -1;
  process.chdir(projectRoot);
  let next;
  try {
    next = await embedAll(paths, {
      collections: config.collections,
      previous,
      onProgress: (done, total) => {
        // Only print when the count crosses a 10% boundary to avoid noisy logs.
        const decile = Math.floor((done / Math.max(total, 1)) * 10);
        const prevDecile = Math.floor((Math.max(lastDone, 0) / Math.max(total, 1)) * 10);
        if (decile !== prevDecile) {
          log.step(`${done} / ${total}`);
        }
        lastDone = done;
      },
    });
  } catch (e) {
    log.error(`Embedding failed: ${(e as Error).message}`);
    process.exitCode = 1;
    return;
  } finally {
    process.chdir(cwdBefore);
  }

  const dest = join(projectRoot, EMBEDDINGS_STORE_PATH);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, serializeStore(next), 'utf8');
  log.success(`${EMBEDDINGS_STORE_PATH} (${Object.keys(next.entries).length} vectors, dim=${next.dim})`);

  // Touch the file so callers see a deterministic mtime in tests.
  await fsPromises.utimes(dest, new Date(), new Date()).catch(() => {});
  log.blank();
}
