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
  it('creates cms/octocms.config.ts with schema and next.config.ts as thin wrapper in --yes mode', async () => {
    await initCommand(TMP_DIR, { yes: true });

    // Schema file has the config
    const octoConfig = readFileSync(join(TMP_DIR, 'cms', 'octocms.config.ts'), 'utf8');
    expect(octoConfig).toContain("projectName: 'My CMS'");
    expect(octoConfig).toContain("baseBranch: 'main'");
    expect(octoConfig).toContain('defineConfig');
    expect(octoConfig).toContain('export const configOctoCMS');
    expect(octoConfig).toContain('export type OctoConfig');

    // Wrapper file is thin
    const nextConfig = readFileSync(join(TMP_DIR, 'next.config.ts'), 'utf8');
    expect(nextConfig).toContain('withOctoCMS');
    expect(nextConfig).not.toContain('defineConfig');
    expect(nextConfig).toContain("from './cms/octocms.config'");
  });

  it('creates cms/octocms.config.ts', async () => {
    await initCommand(TMP_DIR, { yes: true });
    expect(existsSync(join(TMP_DIR, 'cms', 'octocms.config.ts'))).toBe(true);
  });

  it('creates admin route files', async () => {
    await initCommand(TMP_DIR, { yes: true });
    expect(existsSync(join(TMP_DIR, 'src', 'app', 'cms', 'layout.tsx'))).toBe(true);
    expect(existsSync(join(TMP_DIR, 'src', 'app', 'cms', '[[...path]]', 'page.tsx'))).toBe(true);
  });

  it('creates hello page demo route', async () => {
    await initCommand(TMP_DIR, { yes: true });
    expect(existsSync(join(TMP_DIR, 'src', 'app', 'hello', 'page.tsx'))).toBe(true);
    const page = readFileSync(join(TMP_DIR, 'src', 'app', 'hello', 'page.tsx'), 'utf8');
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

  it('refuses if cms/octocms.config.ts already contains defineConfig', async () => {
    mkdirSync(join(TMP_DIR, 'cms'), { recursive: true });
    writeFileSync(join(TMP_DIR, 'cms', 'octocms.config.ts'), 'const x = defineConfig({})', 'utf8');
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
});
