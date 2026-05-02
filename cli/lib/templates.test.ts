import { describe, expect, it } from 'vitest';
import {
  adminErrorTemplate,
  adminLayoutTemplate,
  adminPageTemplate,
  agentProposalRouteTemplate,
  demoHelloPageJson,
  helloPageTemplate,
  LEGACY_ADMIN_CATCH_ALL_TEMPLATES,
  LEGACY_ADMIN_LAYOUT_TEMPLATES,
  nextConfigTemplate,
  octoConfigTemplate,
  tsconfigPaths,
} from './templates';

describe('octoConfigTemplate', () => {
  it('imports defineConfig from octocms/config and Config from octocms/types', () => {
    const out = octoConfigTemplate({ projectName: 'Test', baseBranch: 'main' });
    expect(out).toContain("import { defineConfig } from 'octocms/config'");
    expect(out).toContain("import type { Config } from 'octocms/types'");
  });

  it('uses _typedConfigOctoCMS and configOctoCMS variable names', () => {
    const out = octoConfigTemplate({ projectName: 'Test', baseBranch: 'main' });
    expect(out).toContain('const _typedConfigOctoCMS = defineConfig(');
    expect(out).toContain('export const configOctoCMS: Config = _typedConfigOctoCMS');
    expect(out).toContain('export type OctoConfig = typeof _typedConfigOctoCMS');
  });

  it('generates config with project name', () => {
    const out = octoConfigTemplate({
      projectName: 'My Site',
      baseBranch: 'main',
    });
    expect(out).toContain("projectName: 'My Site'");
    expect(out).toContain("baseBranch: 'main'");
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
  it('layout re-exports from the octocms/admin barrel', () => {
    expect(adminLayoutTemplate).toContain("from 'octocms/admin'");
    expect(adminLayoutTemplate).toContain("export { AdminLayout as default, metadata }");
    expect(adminLayoutTemplate).toContain("import 'octocms/globals.css'");
    expect(adminLayoutTemplate).toContain("import '../../cms/__generated__/configInit'");
  });

  it('catch-all page re-exports AdminApp from the barrel', () => {
    expect(adminPageTemplate).toContain("from 'octocms/admin'");
    expect(adminPageTemplate).toContain("export { AdminApp as default }");
  });

  it('error.tsx is a client component re-exporting AdminError from the barrel', () => {
    expect(adminErrorTemplate).toContain("'use client'");
    expect(adminErrorTemplate).toContain("from 'octocms/admin'");
    expect(adminErrorTemplate).toContain("export { AdminError as default }");
  });
});

describe('legacy template registries (used by `octocms update` for migration)', () => {
  it('records the deep-import layout shape', () => {
    expect(LEGACY_ADMIN_LAYOUT_TEMPLATES.length).toBeGreaterThan(0);
    expect(LEGACY_ADMIN_LAYOUT_TEMPLATES[0]).toContain("from 'octocms/admin/pages/AdminLayout'");
  });

  it('records the deep-import catch-all shape', () => {
    expect(LEGACY_ADMIN_CATCH_ALL_TEMPLATES.length).toBeGreaterThan(0);
    expect(LEGACY_ADMIN_CATCH_ALL_TEMPLATES[0]).toContain("from 'octocms/admin/AdminApp'");
  });
});

describe('agentProposalRouteTemplate', () => {
  it('builds the correct relative configInit import path for src/app/ depth 6', () => {
    const out = agentProposalRouteTemplate({ handlerExport: 'acceptProposalRoute', depth: 6 });
    expect(out).toContain("import '../../../../../../cms/__generated__/configInit'");
    expect(out).toContain("export { acceptProposalRoute as POST } from 'octocms/agent'");
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
