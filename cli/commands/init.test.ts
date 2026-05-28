import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initCommand } from './init';

const TMP_DIR = join(process.cwd(), '.tmp-init-test');

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
  // Create a minimal package.json so init doesn't reject
  writeFileSync(join(TMP_DIR, 'package.json'), '{}', 'utf8');
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
  process.exitCode = undefined;
});

describe('initCommand', () => {
  it('scaffolds the schema-source-of-truth trio (JSON + generated shim + thin TS binding) in --yes mode', async () => {
    await initCommand(TMP_DIR, { yes: true });

    // 1. cms/schema.json — source of truth (Content Model UI reads/writes here).
    const schemaJson = JSON.parse(readFileSync(join(TMP_DIR, 'cms', 'schema.json'), 'utf8'));
    expect(schemaJson.projectName).toBe('My CMS');
    expect(schemaJson.git.baseBranch).toBe('main');
    expect(schemaJson.collections.helloPage).toBeDefined();

    // 2. cms/__generated__/schema.ts — literal-typed defineConfig shim.
    const schemaShim = readFileSync(join(TMP_DIR, 'cms', '__generated__', 'schema.ts'), 'utf8');
    expect(schemaShim).toContain("import { defineConfig } from 'octocms/defineConfig'");
    expect(schemaShim).toContain('export const schema = defineConfig({');
    expect(schemaShim).toContain("projectName: 'My CMS'");

    // 3. cms/octocms.config.ts — thin TS binding (no inline defineConfig).
    const octoConfig = readFileSync(join(TMP_DIR, 'cms', 'octocms.config.ts'), 'utf8');
    expect(octoConfig).toContain("import { schema } from './__generated__/schema'");
    expect(octoConfig).toContain('export const configOctoCMS: Config = _typedConfigOctoCMS as Config');
    expect(octoConfig).toContain('export type OctoConfig = typeof _typedConfigOctoCMS');
    expect(octoConfig).not.toMatch(/defineConfig\s*\(\s*\{/);

    // Wrapper file is still thin.
    const nextConfig = readFileSync(join(TMP_DIR, 'next.config.ts'), 'utf8');
    expect(nextConfig).toContain('withOctoCMS');
    expect(nextConfig).not.toContain('defineConfig');
    expect(nextConfig).toContain("from './cms/octocms.config'");
  });

  it('creates cms/octocms.config.ts', async () => {
    await initCommand(TMP_DIR, { yes: true });
    expect(existsSync(join(TMP_DIR, 'cms', 'octocms.config.ts'))).toBe(true);
  });

  it('creates the 3-file admin route surface (layout + catch-all page + error)', async () => {
    await initCommand(TMP_DIR, { yes: true });
    expect(existsSync(join(TMP_DIR, 'app', 'cms', 'layout.tsx'))).toBe(true);
    expect(existsSync(join(TMP_DIR, 'app', 'cms', '[[...path]]', 'page.tsx'))).toBe(true);
    expect(existsSync(join(TMP_DIR, 'app', 'cms', 'error.tsx'))).toBe(true);
    // No per-segment route files should be scaffolded.
    expect(existsSync(join(TMP_DIR, 'app', 'cms', 'page.tsx'))).toBe(false);
    expect(existsSync(join(TMP_DIR, 'app', 'cms', 'loading.tsx'))).toBe(false);
    expect(existsSync(join(TMP_DIR, 'app', 'cms', 'content'))).toBe(false);
    expect(existsSync(join(TMP_DIR, 'app', 'cms', 'media'))).toBe(false);
    expect(existsSync(join(TMP_DIR, 'app', 'cms', 'model'))).toBe(false);
    expect(existsSync(join(TMP_DIR, 'app', 'cms', 'chat'))).toBe(false);
  });

  it('admin route files re-export from the octocms/admin barrel', async () => {
    await initCommand(TMP_DIR, { yes: true });
    const layout = readFileSync(join(TMP_DIR, 'app', 'cms', 'layout.tsx'), 'utf8');
    const page = readFileSync(join(TMP_DIR, 'app', 'cms', '[[...path]]', 'page.tsx'), 'utf8');
    const error = readFileSync(join(TMP_DIR, 'app', 'cms', 'error.tsx'), 'utf8');
    expect(layout).toContain("from 'octocms/admin'");
    expect(page).toContain("from 'octocms/admin'");
    expect(page).toContain('configInit');
    expect(error).toContain("from 'octocms/admin/error'");
    expect(error).toContain("'use client'");
  });

  it('creates hello page demo route', async () => {
    await initCommand(TMP_DIR, { yes: true });
    expect(existsSync(join(TMP_DIR, 'app', 'hello', 'page.tsx'))).toBe(true);
    const page = readFileSync(join(TMP_DIR, 'app', 'hello', 'page.tsx'), 'utf8');
    expect(page).toContain("from 'cms/__generated__/query'");
    expect(page).toContain("query('helloPage').first()");
  });

  it('creates helloPage singleton demo content', async () => {
    await initCommand(TMP_DIR, { yes: true });
    const jsonPath = join(TMP_DIR, 'cms', 'content', 'helloPage', 'helloPage-0000.json');
    expect(existsSync(jsonPath)).toBe(true);

    const entry = JSON.parse(readFileSync(jsonPath, 'utf8'));
    expect(entry.sys.id).toBe('0000');
    expect(entry.sys.type).toBe('helloPage');
    expect(entry.sys.status).toBe('merged');
    expect(entry.fields.title).toBe('Hello World');
    expect(entry.fields.description).toBeTruthy();
  });

  it('creates next.config.ts containing withOctoCMS', async () => {
    await initCommand(TMP_DIR, { yes: true });
    const nextConfig = readFileSync(join(TMP_DIR, 'next.config.ts'), 'utf8');
    expect(nextConfig).toContain('withOctoCMS');
  });

  it('refuses if cms/octocms.config.ts already exports configOctoCMS', async () => {
    mkdirSync(join(TMP_DIR, 'cms'), { recursive: true });
    writeFileSync(join(TMP_DIR, 'cms', 'octocms.config.ts'), 'export const configOctoCMS: any = {};\n', 'utf8');
    await initCommand(TMP_DIR, { yes: true });
    expect(process.exitCode).toBe(1);
  });

  it('refuses if cms/schema.json already exists (project initialized via the JSON source)', async () => {
    mkdirSync(join(TMP_DIR, 'cms'), { recursive: true });
    writeFileSync(join(TMP_DIR, 'cms', 'schema.json'), '{}', 'utf8');
    await initCommand(TMP_DIR, { yes: true });
    expect(process.exitCode).toBe(1);
  });

  it('refuses if no package.json', async () => {
    rmSync(join(TMP_DIR, 'package.json'));
    await initCommand(TMP_DIR, { yes: true });
    expect(process.exitCode).toBe(1);
  });

  it('creates required directories', async () => {
    await initCommand(TMP_DIR, { yes: true });
    expect(existsSync(join(TMP_DIR, 'cms', '__generated__'))).toBe(true);
    expect(existsSync(join(TMP_DIR, 'public', 'media'))).toBe(true);
  });

  it('writes static cms/__generated__ files without running codegen', async () => {
    await initCommand(TMP_DIR, { yes: true });
    const gen = (f: string) => join(TMP_DIR, 'cms', '__generated__', f);
    expect(existsSync(gen('types.ts'))).toBe(true);
    expect(existsSync(gen('enums.ts'))).toBe(true);
    expect(existsSync(gen('content.d.ts'))).toBe(true);
    expect(existsSync(gen('index.ts'))).toBe(true);
    expect(existsSync(gen('query.ts'))).toBe(true);
    expect(existsSync(gen('configInit.ts'))).toBe(true);

    const types = readFileSync(gen('types.ts'), 'utf8');
    expect(types).toContain('HelloPageEntry');
    expect(types).toContain("type: 'helloPage'");

    const query = readFileSync(gen('query.ts'), 'utf8');
    expect(query).toContain("from 'octocms/query'");
    expect(query).toContain('createQuery<EntryMap, OctoConfig>');

    const configInit = readFileSync(gen('configInit.ts'), 'utf8');
    expect(configInit).toContain("from 'octocms/lib/configStore'");
    expect(configInit).toContain('setConfig(configOctoCMS)');
  });

  it('creates octocms API route re-exports', async () => {
    await initCommand(TMP_DIR, { yes: true });
    expect(existsSync(join(TMP_DIR, 'app', 'api', 'octocms', 'auth', '[action]', 'route.ts'))).toBe(true);
    expect(existsSync(join(TMP_DIR, 'app', 'api', 'octocms', 'agent', 'route.ts'))).toBe(true);
    expect(existsSync(join(TMP_DIR, 'app', 'api', 'octocms', 'search', 'route.ts'))).toBe(true);
  });

  it('creates .env.local stub', async () => {
    await initCommand(TMP_DIR, { yes: true });
    expect(existsSync(join(TMP_DIR, '.env.local'))).toBe(true);
    const env = readFileSync(join(TMP_DIR, '.env.local'), 'utf8');
    expect(env).toContain('GITHUB_ID=');
    expect(env).toContain('GITHUB_SECRET=');
    expect(env).toContain('NEXTAUTH_SECRET=');
  });

  it('does not overwrite existing .env.local', async () => {
    writeFileSync(join(TMP_DIR, '.env.local'), 'GITHUB_ID=existing', 'utf8');
    await initCommand(TMP_DIR, { yes: true });
    const env = readFileSync(join(TMP_DIR, '.env.local'), 'utf8');
    expect(env).toBe('GITHUB_ID=existing');
  });

  it('creates README.md', async () => {
    await initCommand(TMP_DIR, { yes: true });
    expect(existsSync(join(TMP_DIR, 'README.md'))).toBe(true);
    const readme = readFileSync(join(TMP_DIR, 'README.md'), 'utf8');
    expect(readme).toContain('GITHUB_ID');
    expect(readme).toContain('NEXTAUTH_SECRET');
  });

  it('does not overwrite existing README.md', async () => {
    writeFileSync(join(TMP_DIR, 'README.md'), '# Existing', 'utf8');
    await initCommand(TMP_DIR, { yes: true });
    const readme = readFileSync(join(TMP_DIR, 'README.md'), 'utf8');
    expect(readme).toBe('# Existing');
  });

  it('updates tsconfig.json with path aliases', async () => {
    writeFileSync(join(TMP_DIR, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }), 'utf8');
    await initCommand(TMP_DIR, { yes: true });
    const tsconfig = JSON.parse(readFileSync(join(TMP_DIR, 'tsconfig.json'), 'utf8'));
    expect(tsconfig.compilerOptions.paths['octocms/*']).toBeUndefined();
    expect(tsconfig.compilerOptions.paths['cms/__generated__']).toEqual(['./cms/__generated__/index.ts']);
    expect(tsconfig.compilerOptions.paths['@/*']).toEqual(['./src/*']);
  });

  it('detects dev port from package.json scripts', async () => {
    writeFileSync(join(TMP_DIR, 'package.json'), JSON.stringify({ scripts: { dev: 'next dev -p 3001' } }), 'utf8');
    // Capture log output by checking the process doesn't crash and files are created
    await initCommand(TMP_DIR, { yes: true });
    // If port detection worked, init should complete successfully
    expect(existsSync(join(TMP_DIR, 'next.config.ts'))).toBe(true);
  });

  it('keeps REQUIRED_PEER_DEPS in sync with package.json peerDependencies (minus optional + react/next)', async () => {
    // Guard test — adding a new required peer dep to package.json fails CI
    // until the printed `npm install` line in init.ts is updated. We re-read
    // the source to avoid exporting an internal constant.
    const initSrc = readFileSync(join(__dirname, 'init.ts'), 'utf8');
    const block = /const REQUIRED_PEER_DEPS:[^=]*=\s*\[([\s\S]*?)\];/m.exec(initSrc);
    expect(block, 'REQUIRED_PEER_DEPS array not found in init.ts').toBeTruthy();
    const declared = (block![1].match(/'([^']+)'/g) ?? []).map((s) => s.slice(1, -1));

    const pkgPath = join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const optional = new Set(Object.keys(pkg.peerDependenciesMeta ?? {}));
    const expected = Object.keys(pkg.peerDependencies ?? {})
      .filter((k) => !optional.has(k))
      .filter((k) => k !== 'next' && k !== 'react' && k !== 'react-dom')
      .sort();
    expect(declared.slice().sort()).toEqual(expected);
  });
});
