import { describe, expect, it } from 'vitest';
import {
  adminErrorTemplate,
  agentChatRouteTemplate,
  buildAdminLayoutTemplate,
  buildAdminPageTemplate,
  demoHelloPageJson,
  generatedSchemaShimTemplate,
  helloPageTemplate,
  LEGACY_ADMIN_CATCH_ALL_TEMPLATES,
  LEGACY_ADMIN_LAYOUT_TEMPLATES,
  mediaRouteTemplate,
  nextConfigTemplate,
  octoConfigTemplate,
  rootLayoutConfigInitImport,
  rootLayoutTemplate,
  schemaJsonTemplate,
  searchRouteTemplate,
  tsconfigPaths,
} from './templates';

describe('octoConfigTemplate (thin TS binding to the generated shim)', () => {
  it('imports schema from the generated shim and Config from octocms/types', () => {
    const out = octoConfigTemplate({ projectName: 'Test', baseBranch: 'main' });
    expect(out).toContain("import type { Config } from 'octocms/types'");
    expect(out).toContain("import { schema } from './__generated__/schema'");
  });

  it('re-exports configOctoCMS (Config) and OctoConfig (literal type)', () => {
    const out = octoConfigTemplate({ projectName: 'Test', baseBranch: 'main' });
    expect(out).toContain('const _typedConfigOctoCMS = schema');
    expect(out).toContain('export const configOctoCMS: Config = _typedConfigOctoCMS as Config');
    expect(out).toContain('export type OctoConfig = typeof _typedConfigOctoCMS');
  });

  it('does NOT inline a defineConfig() call (schema lives in cms/schema.json)', () => {
    const out = octoConfigTemplate({ projectName: 'My Site', baseBranch: 'main' });
    expect(out).not.toContain("from 'octocms/config'");
    // The literal call form `defineConfig({` would inline the schema. The
    // docstring may still mention `defineConfig()` as prose — that's fine.
    expect(out).not.toMatch(/defineConfig\s*\(\s*\{/);
  });
});

describe('schemaJsonTemplate (cms/schema.json — source of truth)', () => {
  it('emits valid JSON with the user-supplied projectName and baseBranch', () => {
    const json = JSON.parse(schemaJsonTemplate({ projectName: 'My Site', baseBranch: 'main' }));
    expect(json.projectName).toBe('My Site');
    expect(json.git.baseBranch).toBe('main');
    expect(json.git.publishedPointerBranch).toBeUndefined();
    expect(json.collections.helloPage.fields.title.entryTitle).toBe(true);
  });

  it('includes publishedPointerBranch when supplied', () => {
    const json = JSON.parse(
      schemaJsonTemplate({ projectName: 'X', baseBranch: 'main', pointerBranch: 'cms/publish-pointer' }),
    );
    expect(json.git.publishedPointerBranch).toBe('cms/publish-pointer');
  });
});

describe('generatedSchemaShimTemplate (cms/__generated__/schema.ts — literal-typed mirror)', () => {
  it('mirrors the user-supplied projectName/baseBranch via defineConfig (preserves literal types)', () => {
    const out = generatedSchemaShimTemplate({ projectName: 'My Site', baseBranch: 'develop' });
    expect(out).toContain("import { defineConfig } from 'octocms/defineConfig'");
    expect(out).toContain('export const schema = defineConfig({');
    expect(out).toContain("projectName: 'My Site'");
    expect(out).toContain("baseBranch: 'develop'");
    expect(out).toContain('AUTO-GENERATED');
  });

  it('inlines publishedPointerBranch in the git block when supplied', () => {
    const out = generatedSchemaShimTemplate({
      projectName: 'X',
      baseBranch: 'main',
      pointerBranch: 'cms/publish-pointer',
    });
    expect(out).toMatch(/git:\s*\{[\s\S]*publishedPointerBranch:\s*'cms\/publish-pointer'/);
  });
});

describe('nextConfigTemplate', () => {
  it('is a thin wrapper that calls withOctoCMS', () => {
    const out = nextConfigTemplate();
    expect(out).toContain("import { withOctoCMS } from 'octocms/config'");
    expect(out).toContain("import { configOctoCMS } from './cms/octocms.config'");
    expect(out).toContain('withOctoCMS(nextConfig, configOctoCMS)');
  });
});

describe('helloPageTemplate', () => {
  it('queries helloPage from the generated query binding', () => {
    expect(helloPageTemplate).toContain("from 'cms/__generated__/query'");
    expect(helloPageTemplate).toContain("query('helloPage').first()");
  });
});

describe('tsconfigPaths', () => {
  it('returns the required path aliases', () => {
    const paths = tsconfigPaths();
    expect(paths['cms/__generated__']).toEqual(['./cms/__generated__/index.ts']);
    expect(paths['cms/__generated__/*']).toEqual(['./cms/__generated__/*']);
    expect(paths['@/*']).toEqual(['./src/*']);
  });
});

describe('admin route templates (3-file model)', () => {
  it('layout re-exports from the octocms/admin barrel and bare-imports configInit', () => {
    const layout = buildAdminLayoutTemplate();
    expect(layout).toContain("from 'octocms/admin'");
    expect(layout).toContain('export { AdminLayout as default, metadata }');
    expect(layout).toContain("import 'octocms/globals.css'");
    expect(layout).toContain("import 'cms/__generated__/configInit'");
    expect(layout).not.toMatch(/'\.\.\/.*cms\/__generated__/);
  });

  it('catch-all page re-exports AdminApp and side-effect-imports configInit (bare specifier)', () => {
    const page = buildAdminPageTemplate();
    expect(page).toContain("from 'octocms/admin'");
    expect(page).toContain('export { AdminApp as default }');
    expect(page).toContain("import 'cms/__generated__/configInit'");
    expect(page).not.toMatch(/'\.\.\/.*cms\/__generated__/);
  });

  it('error.tsx is a client component re-exporting AdminError from the barrel', () => {
    expect(adminErrorTemplate).toContain("'use client'");
    expect(adminErrorTemplate).toContain("from 'octocms/admin'");
    expect(adminErrorTemplate).toContain('export { AdminError as default }');
  });
});

describe('route handler templates (depth-agnostic via withOctoCMS alias)', () => {
  it('agent chat route side-effect-imports configInit via bare specifier', () => {
    const out = agentChatRouteTemplate();
    expect(out).toContain("import 'cms/__generated__/configInit'");
    expect(out).not.toMatch(/'\.\.\/.*cms\/__generated__/);
    expect(out).toContain("from 'octocms/agent'");
  });

  it('media route side-effect-imports configInit via bare specifier', () => {
    const out = mediaRouteTemplate();
    expect(out).toContain("import 'cms/__generated__/configInit'");
    expect(out).not.toMatch(/'\.\.\/.*cms\/__generated__/);
    expect(out).toContain("from 'octocms/admin/mediaRoute'");
  });

  it('search route side-effect-imports configInit via bare specifier', () => {
    const out = searchRouteTemplate();
    expect(out).toContain("import 'cms/__generated__/configInit'");
    expect(out).not.toMatch(/'\.\.\/.*cms\/__generated__/);
    expect(out).toContain("from 'octocms/admin/searchRoute'");
  });
});

describe('root layout templates (depth-agnostic via withOctoCMS alias)', () => {
  it('rootLayoutTemplate uses bare-specifier configInit', () => {
    expect(rootLayoutTemplate).toContain("import 'cms/__generated__/configInit'");
    expect(rootLayoutTemplate).not.toMatch(/'\.\.\/.*cms\/__generated__/);
  });

  it('rootLayoutConfigInitImport one-liner is also a bare-specifier import', () => {
    expect(rootLayoutConfigInitImport).toBe("import 'cms/__generated__/configInit';\n");
  });
});

describe('legacy template registries (used by `octocms update` for migration)', () => {
  it('records the deep-import layout shape', () => {
    expect(LEGACY_ADMIN_LAYOUT_TEMPLATES.length).toBeGreaterThan(0);
    expect(LEGACY_ADMIN_LAYOUT_TEMPLATES[0]).toContain("from 'octocms/admin/pages/AdminLayout'");
  });

  it('records legacy catch-all shapes (deep import + barrel without page configInit + depth-counted)', () => {
    expect(LEGACY_ADMIN_CATCH_ALL_TEMPLATES.length).toBe(3);
    expect(LEGACY_ADMIN_CATCH_ALL_TEMPLATES[0]).toContain("from 'octocms/admin/AdminApp'");
    expect(LEGACY_ADMIN_CATCH_ALL_TEMPLATES[1]).toContain("from 'octocms/admin'");
    expect(LEGACY_ADMIN_CATCH_ALL_TEMPLATES[2]).toContain("import '../../../cms/__generated__/configInit'");
  });
});

describe('demoHelloPageJson', () => {
  it('returns valid JSON with sys and fields', () => {
    const json = JSON.parse(demoHelloPageJson());
    expect(json.sys.id).toBe('0000');
    expect(json.sys.type).toBe('helloPage');
    expect(json.sys.status).toBe('merged');
    expect(json.fields.title).toBe('Hello World');
    expect(json.fields.description).toBeTruthy();
  });
});
