/**
 * `octocms validate` — Validate all content entries against the CMS schema.
 *
 * Reads every JSON file in `cms/content/`, validates structure, field types,
 * required fields, select option values, reference targets, and companion files.
 */

import { fmt, log } from '../lib/logger';
import { validateContent } from '../lib/contentValidator';
import { loadCollections, loadProjectConfig } from '../lib/project';
import { validateConfig } from '../lib/validateConfig';

export async function validateCommand(projectRoot: string): Promise<void> {
  log.header('Validate content');

  const config = await loadProjectConfig(projectRoot);
  const collections = await loadCollections(projectRoot);

  // Validate config first
  try {
    validateConfig(config, collections);
  } catch (e) {
    log.error(`Config error: ${(e as Error).message}`);
    process.exitCode = 1;
    return;
  }

  const collectionNames = Object.keys(config.collections);
  log.info(`Validating ${collectionNames.length} collections...`);
  log.blank();

  const result = validateContent(projectRoot, config);

  // Group errors by file
  const errorsByFile = new Map<string, typeof result.errors>();
  for (const err of result.errors) {
    const key = `${err.collection}/${err.file}`;
    if (!errorsByFile.has(key)) errorsByFile.set(key, []);
    errorsByFile.get(key)!.push(err);
  }

  // Report per collection
  let totalEntries = 0;
  for (const name of collectionNames) {
    const count = result.counts[name] ?? 0;
    totalEntries += count;

    const collErrors = result.errors.filter((e) => e.collection === name);
    if (collErrors.length === 0) {
      log.success(`${name} — ${count} ${count === 1 ? 'entry' : 'entries'}`);
    } else {
      const errorFiles = new Set(collErrors.map((e) => e.file));
      log.error(`${name} — ${count} ${count === 1 ? 'entry' : 'entries'}, ${errorFiles.size} with errors`);
    }
  }

  // Show detailed errors
  if (errorsByFile.size > 0) {
    log.blank();
    for (const [fileKey, fileErrors] of errorsByFile) {
      log.error(fileKey);
      for (const err of fileErrors) {
        const field = err.field ? `${fmt.dim(err.field)}: ` : '';
        log.info(`  ${fmt.yellow('•')} ${field}${err.message}`);
      }
    }
    log.blank();
    log.error(`${result.errors.length} ${result.errors.length === 1 ? 'error' : 'errors'} found.`);
    process.exitCode = 1;
  } else {
    log.blank();
    log.success(`All ${totalEntries} ${totalEntries === 1 ? 'entry' : 'entries'} valid.`);
  }

  log.blank();
}
