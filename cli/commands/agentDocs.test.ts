import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { agentDocsCommand } from "./agentDocs";
import { agentsMdSection, agentsMdTemplate } from "../lib/templates";

const TMP_DIR = join(process.cwd(), ".tmp-agent-docs-test");
const MARKER = "<!-- octocms:agent-docs -->";

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("agentDocsCommand", () => {
  it("creates AGENTS.md when it does not exist", async () => {
    await agentDocsCommand(TMP_DIR);
    const agentsPath = join(TMP_DIR, "AGENTS.md");
    expect(existsSync(agentsPath)).toBe(true);
    const content = readFileSync(agentsPath, "utf8");
    expect(content).toBe(agentsMdTemplate());
  });

  it("created file contains marker and doc links", async () => {
    await agentDocsCommand(TMP_DIR);
    const content = readFileSync(join(TMP_DIR, "AGENTS.md"), "utf8");
    expect(content).toContain(MARKER);
    expect(content).toContain("octocms/docs/overview.md");
    expect(content).toContain("octocms/docs/schema.md");
  });

  it("appends section to existing AGENTS.md without marker", async () => {
    const existing = "# My Project\n\nSome guidelines here.\n";
    writeFileSync(join(TMP_DIR, "AGENTS.md"), existing, "utf8");

    await agentDocsCommand(TMP_DIR);

    const content = readFileSync(join(TMP_DIR, "AGENTS.md"), "utf8");
    expect(content).toContain("# My Project");
    expect(content).toContain("Some guidelines here.");
    expect(content).toContain(MARKER);
    expect(content).toContain("octocms/docs/overview.md");
  });

  it("does not duplicate section when marker already present", async () => {
    writeFileSync(join(TMP_DIR, "AGENTS.md"), agentsMdTemplate(), "utf8");

    await agentDocsCommand(TMP_DIR);

    const content = readFileSync(join(TMP_DIR, "AGENTS.md"), "utf8");
    const markerCount = content.split(MARKER).length - 1;
    expect(markerCount).toBe(1);
  });

  it("preserves existing content when appending", async () => {
    const existing = "# Existing\n\n- Rule 1\n- Rule 2\n";
    writeFileSync(join(TMP_DIR, "AGENTS.md"), existing, "utf8");

    await agentDocsCommand(TMP_DIR);

    const content = readFileSync(join(TMP_DIR, "AGENTS.md"), "utf8");
    expect(content.startsWith("# Existing")).toBe(true);
    expect(content).toContain("- Rule 1");
    expect(content).toContain("- Rule 2");
    expect(content).toContain(agentsMdSection());
  });
});
