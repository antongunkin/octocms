/**
 * `octocms types:gen` — Generate TypeScript types from next.config.ts.
 *
 * Produces `cms/__generated__/types.ts`, `enums.ts`, `content.d.ts`, and `index.ts`.
 * This is the CLI equivalent of `npm run types:gen`.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import {
  generateConfigInit,
  generateContentDecls,
  generateEnums,
  generateIndex,
  generateQuery,
  generateTypes,
} from '../lib/codegen';
import { log } from '../lib/logger';
import { loadCollections, loadFieldTypes, loadProjectConfig } from '../lib/project';
import { validateConfig } from '../lib/validateConfig';

export async function typesGenCommand(projectRoot: string): Promise<void> {
  log.header('Generate types');

  const config = await loadProjectConfig(projectRoot);
  const collections = await loadCollections(projectRoot);
  const fieldTypes = await loadFieldTypes(projectRoot);

  log.info('Validating config...');
  try {
    validateConfig(config, collections);
  } catch (e) {
    log.error(String((e as Error).message));
    process.exitCode = 1;
    return;
  }
  log.success(`${collections.length} collections validated`);

  log.blank();
  log.info('Generating types...');

  const generatedDir = join(projectRoot, 'cms', '__generated__');
  mkdirSync(generatedDir, { recursive: true });

  const files = [
    { name: 'types.ts', content: generateTypes(config, collections) },
    { name: 'enums.ts', content: generateEnums(config, collections, fieldTypes) },
    { name: 'content.d.ts', content: generateContentDecls(config, collections) },
    { name: 'index.ts', content: generateIndex() },
    { name: 'query.ts', content: generateQuery() },
    { name: 'configInit.ts', content: generateConfigInit() },
  ];

  for (const file of files) {
    writeFileSync(join(generatedDir, file.name), file.content, 'utf8');
    log.success(`cms/__generated__/${file.name}`);
  }

  log.blank();
}
