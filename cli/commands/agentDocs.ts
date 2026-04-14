/**
 * `octocms agent-docs` — Inject AI agent documentation links into AGENTS.md.
 *
 * Creates AGENTS.md if it doesn't exist, or appends the OctoCMS section
 * if the file exists but doesn't contain it yet.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { log } from "../lib/logger";
import { agentsMdSection, agentsMdTemplate } from "../lib/templates";

export async function agentDocsCommand(projectRoot: string): Promise<void> {
  log.header("Agent documentation");

  const agentsMdPath = join(projectRoot, "AGENTS.md");
  const MARKER = "<!-- octocms:agent-docs -->";

  if (!existsSync(agentsMdPath)) {
    writeFileSync(agentsMdPath, agentsMdTemplate(), "utf8");
    log.success("AGENTS.md — created with OctoCMS agent docs section");
  } else {
    const current = readFileSync(agentsMdPath, "utf8");
    if (current.includes(MARKER)) {
      log.success("AGENTS.md — OctoCMS section already present");
    } else {
      const updated = current.trimEnd() + "\n\n" + agentsMdSection() + "\n";
      writeFileSync(agentsMdPath, updated, "utf8");
      log.step("AGENTS.md — appended OctoCMS agent docs section");
    }
  }

  log.blank();
  log.info(
    "AI agents can now read octocms/docs/ for content management instructions.",
  );
  log.info("Regenerate the docs after schema changes: npm run agent-docs:gen");
  log.blank();
}
