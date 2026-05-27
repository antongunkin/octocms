/**
 * `octocms agent-docs` — Inject AI agent documentation links into AGENTS.md.
 *
 * Creates AGENTS.md if it doesn't exist, or appends/replaces the OctoCMS section.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { log } from '../lib/logger';
import { agentsMdSection, agentsMdTemplate } from '../lib/templates';

export const AGENT_DOCS_MARKER = '<!-- octocms:agent-docs -->';

/** Replace an existing OctoCMS section or append a new one. */
export function upsertAgentsMdSection(content: string, section: string): string {
  const markerIndex = content.indexOf(AGENT_DOCS_MARKER);
  if (markerIndex === -1) {
    return content.trimEnd() + '\n\n' + section + '\n';
  }

  const before = content.slice(0, markerIndex).trimEnd();
  const afterMarker = content.slice(markerIndex + AGENT_DOCS_MARKER.length);
  const nextSectionIndex = afterMarker.indexOf('\n\n## ', 1);
  const tail = nextSectionIndex === -1 ? '' : afterMarker.slice(nextSectionIndex + 2).trimStart();
  const parts = [before, section.trimEnd()];
  if (tail) parts.push(tail);
  return parts.join('\n\n') + '\n';
}

export async function agentDocsCommand(projectRoot: string): Promise<void> {
  log.header('Agent documentation');

  const agentsMdPath = join(projectRoot, 'AGENTS.md');
  const section = agentsMdSection();

  if (!existsSync(agentsMdPath)) {
    writeFileSync(agentsMdPath, agentsMdTemplate(), 'utf8');
    log.success('AGENTS.md — created with OctoCMS agent docs section');
  } else {
    const current = readFileSync(agentsMdPath, 'utf8');
    if (current.includes(AGENT_DOCS_MARKER)) {
      writeFileSync(agentsMdPath, upsertAgentsMdSection(current, section), 'utf8');
      log.step('AGENTS.md — updated OctoCMS agent docs section');
    } else {
      writeFileSync(agentsMdPath, upsertAgentsMdSection(current, section), 'utf8');
      log.step('AGENTS.md — appended OctoCMS agent docs section');
    }
  }

  log.blank();
  log.info('Package docs: octocms/docs/overview.md, octocms/docs/editing-schema.md');
  log.info('Project docs: cms/__generated__/agent-docs/ (regenerate with npm run agent-docs:gen)');
  log.blank();
}
