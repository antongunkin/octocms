/**
 * `octocms init` — Initialize OctoCMS in a Next.js project.
 *
 * Writes the full CMS config inline into `next.config.ts`, creates admin
 * route files, demo content, and updates `tsconfig.json` with required
 * path aliases.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import readline from "readline";

import { log } from "../lib/logger";
import {
  adminLayoutTemplate,
  adminPageTemplate,
  demoPostJson,
  demoPostMarkdown,
  nextConfigTemplate,
  octoConfigTemplate,
  tsconfigPaths,
} from "../lib/templates";

export type InitOptions = {
  /** Accept all defaults without prompting. */
  yes?: boolean;
};

type InitAnswers = {
  projectName: string;
  baseBranch: string;
  usePointerBranch: boolean;
  pointerBranch: string;
};

async function prompt(
  rl: readline.Interface,
  question: string,
  defaultValue?: string,
): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  return new Promise((resolve) => {
    rl.question(`  ? ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

async function confirm(
  rl: readline.Interface,
  question: string,
  defaultYes = false,
): Promise<boolean> {
  const hint = defaultYes ? "Y/n" : "y/N";
  const answer = await prompt(rl, `${question} (${hint})`);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith("y");
}

async function gatherAnswers(options: InitOptions): Promise<InitAnswers> {
  if (options.yes) {
    return {
      projectName: "My CMS",
      baseBranch: "main",
      usePointerBranch: false,
      pointerBranch: "",
    };
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const projectName = await prompt(rl, "Project name", "My CMS");
    const baseBranch = await prompt(rl, "Git base branch", "main");
    const usePointerBranch = await confirm(
      rl,
      "Use a separate published pointer branch?",
    );
    let pointerBranch = "";
    if (usePointerBranch) {
      pointerBranch = await prompt(
        rl,
        "Pointer branch name",
        "cms/publish-pointer",
      );
    }

    return { projectName, baseBranch, usePointerBranch, pointerBranch };
  } finally {
    rl.close();
  }
}

export async function initCommand(
  projectRoot: string,
  options: InitOptions = {},
): Promise<void> {
  log.header("Initialize a new project");

  // Already initialized if cms/octocms.config.ts already contains defineConfig
  const octoConfigPath = join(projectRoot, "cms", "octocms.config.ts");
  if (
    existsSync(octoConfigPath) &&
    readFileSync(octoConfigPath, "utf8").includes("defineConfig")
  ) {
    log.error(
      "cms/octocms.config.ts already contains defineConfig — this project is already initialized.",
    );
    log.info("Use `octocms update` to regenerate admin route files.");
    process.exitCode = 1;
    return;
  }
  const nextConfigPath = join(projectRoot, "next.config.ts");

  if (!existsSync(join(projectRoot, "package.json"))) {
    log.error("No package.json found — run this inside a Next.js project.");
    process.exitCode = 1;
    return;
  }

  const answers = await gatherAnswers(options);

  log.blank();
  log.info("Creating files...");

  // Admin route files
  const cmsRouteDir = join(projectRoot, "src", "app", "cms");
  mkdirSync(join(cmsRouteDir, "[[...path]]"), { recursive: true });

  writeFileSync(join(cmsRouteDir, "layout.tsx"), adminLayoutTemplate, "utf8");
  log.success("src/app/cms/layout.tsx");

  writeFileSync(
    join(cmsRouteDir, "[[...path]]", "page.tsx"),
    adminPageTemplate,
    "utf8",
  );
  log.success("src/app/cms/[[...path]]/page.tsx");

  // Demo content
  const demoId = "001";
  const contentDir = join(projectRoot, "cms", "content", "post");
  mkdirSync(contentDir, { recursive: true });

  writeFileSync(
    join(contentDir, `post-${demoId}.json`),
    demoPostJson(demoId),
    "utf8",
  );
  log.success(`cms/content/post/post-${demoId}.json`);

  writeFileSync(
    join(contentDir, `post-${demoId}.body.md`),
    demoPostMarkdown,
    "utf8",
  );
  log.success(`cms/content/post/post-${demoId}.body.md`);

  // Generated types directory
  mkdirSync(join(projectRoot, "cms", "__generated__"), { recursive: true });

  // Media directory
  mkdirSync(join(projectRoot, "public", "media"), { recursive: true });

  // cms/octocms.config.ts — write the OctoCMS schema
  log.blank();
  log.info("Updating configuration...");
  mkdirSync(join(projectRoot, "cms"), { recursive: true });
  writeFileSync(
    octoConfigPath,
    octoConfigTemplate({
      projectName: answers.projectName,
      baseBranch: answers.baseBranch,
      pointerBranch: answers.usePointerBranch
        ? answers.pointerBranch
        : undefined,
    }),
    "utf8",
  );
  log.success("cms/octocms.config.ts — OctoCMS schema");

  // next.config.ts — write the thin Next.js wrapper
  writeFileSync(nextConfigPath, nextConfigTemplate(), "utf8");
  log.success("next.config.ts — Next.js wrapper");

  // tsconfig.json
  const tsconfigPath = join(projectRoot, "tsconfig.json");
  if (existsSync(tsconfigPath)) {
    try {
      const raw = readFileSync(tsconfigPath, "utf8");
      const tsconfig = JSON.parse(raw);
      if (!tsconfig.compilerOptions) tsconfig.compilerOptions = {};
      if (!tsconfig.compilerOptions.paths) tsconfig.compilerOptions.paths = {};
      const requiredPaths = tsconfigPaths();
      let changed = false;
      for (const [alias, targets] of Object.entries(requiredPaths)) {
        if (!tsconfig.compilerOptions.paths[alias]) {
          tsconfig.compilerOptions.paths[alias] = targets;
          changed = true;
        }
      }
      if (changed) {
        writeFileSync(
          tsconfigPath,
          JSON.stringify(tsconfig, null, 2) + "\n",
          "utf8",
        );
        log.success("tsconfig.json — added octocms/* path aliases");
      } else {
        log.success("tsconfig.json — path aliases already present");
      }
    } catch {
      log.warn("tsconfig.json — could not parse; add octocms/* paths manually");
    }
  } else {
    log.warn(
      "tsconfig.json not found — create one with octocms/* path aliases",
    );
  }

  log.blank();
  log.info("Next steps:");
  log.info("  1. Add GitHub App credentials to .env.local (see README.md)");
  log.info("  2. Run: npm run octocms types:gen");
  log.info("  3. Run: npm run dev");
  log.info("  4. Visit: http://localhost:3001/cms");
  log.blank();
}
