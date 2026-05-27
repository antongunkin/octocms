import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { agentDocsCommand, upsertAgentsMdSection } from './agentDocs';
import { agentsMdSection, agentsMdTemplate } from '../lib/templates';

const TMP_DIR = join(process.cwd(), '.tmp-agent-docs-test');
const MARKER = '<!-- octocms:agent-docs -->';

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('upsertAgentsMdSection', () => {
  it('appends when marker is absent', () => {
    const out = upsertAgentsMdSection('# Existing\n', agentsMdSection());
    expect(out).toContain('# Existing');
    expect(out).toContain(MARKER);
  });

  it('replaces existing section when marker is present', () => {
    const stale = `# Existing\n\n${agentsMdSection()}\n\n## Other\n\nKeep me.\n`;
    const updated = upsertAgentsMdSection(stale, `${MARKER}\n## OctoCMS — Updated\n`);
    expect(updated).toContain('# Existing');
    expect(updated).toContain('## OctoCMS — Updated');
    expect(updated).toContain('## Other');
    expect(updated).toContain('Keep me.');
    expect(updated.split(MARKER).length - 1).toBe(1);
  });
});

describe('agentDocsCommand', () => {
  it('creates AGENTS.md when it does not exist', async () => {
    await agentDocsCommand(TMP_DIR);
    const agentsPath = join(TMP_DIR, 'AGENTS.md');
    expect(existsSync(agentsPath)).toBe(true);
    const content = readFileSync(agentsPath, 'utf8');
    expect(content).toBe(agentsMdTemplate());
  });

  it('created file contains marker and doc links', async () => {
    await agentDocsCommand(TMP_DIR);
    const content = readFileSync(join(TMP_DIR, 'AGENTS.md'), 'utf8');
    expect(content).toContain(MARKER);
    expect(content).toContain('octocms/docs/overview.md');
    expect(content).toContain('cms/__generated__/agent-docs/schema.md');
    expect(content).toContain('cms/__generated__/agent-docs/collections.md');
  });

  it('appends section to existing AGENTS.md without marker', async () => {
    const existing = '# My Project\n\nSome guidelines here.\n';
    writeFileSync(join(TMP_DIR, 'AGENTS.md'), existing, 'utf8');

    await agentDocsCommand(TMP_DIR);

    const content = readFileSync(join(TMP_DIR, 'AGENTS.md'), 'utf8');
    expect(content).toContain('# My Project');
    expect(content).toContain('Some guidelines here.');
    expect(content).toContain(MARKER);
    expect(content).toContain('octocms/docs/overview.md');
  });

  it('replaces section when marker already present', async () => {
    const stale = `# Existing\n\n${MARKER}\n## OctoCMS — AI Content Management\n\n- \`octocms/docs/schema.md\`\n`;
    writeFileSync(join(TMP_DIR, 'AGENTS.md'), stale, 'utf8');

    await agentDocsCommand(TMP_DIR);

    const content = readFileSync(join(TMP_DIR, 'AGENTS.md'), 'utf8');
    expect(content.split(MARKER).length - 1).toBe(1);
    expect(content).not.toContain('octocms/docs/schema.md');
    expect(content).toContain('cms/__generated__/agent-docs/schema.md');
  });

  it('preserves existing content when appending', async () => {
    const existing = '# Existing\n\n- Rule 1\n- Rule 2\n';
    writeFileSync(join(TMP_DIR, 'AGENTS.md'), existing, 'utf8');

    await agentDocsCommand(TMP_DIR);

    const content = readFileSync(join(TMP_DIR, 'AGENTS.md'), 'utf8');
    expect(content.startsWith('# Existing')).toBe(true);
    expect(content).toContain('- Rule 1');
    expect(content).toContain('- Rule 2');
    expect(content).toContain(agentsMdSection());
  });
});
