/**
 * `octocms update` — Regenerate admin route files in `src/app/cms/`.
 *
 * Ensures the admin layout and catch-all page re-export files are up-to-date
 * with the latest OctoCMS version. Useful after upgrading `octocms`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { log } from "../lib/logger";
import { adminLayoutTemplate, adminPageTemplate } from "../lib/templates";

type FileCheck = {
  path: string;
  displayPath: string;
  expected: string;
};

export async function updateCommand(projectRoot: string): Promise<void> {
  log.header("Update admin routes");

  const files: FileCheck[] = [
    {
      path: join(projectRoot, "src", "app", "cms", "layout.tsx"),
      displayPath: "src/app/cms/layout.tsx",
      expected: adminLayoutTemplate,
    },
    {
      path: join(projectRoot, "src", "app", "cms", "[[...path]]", "page.tsx"),
      displayPath: "src/app/cms/[[...path]]/page.tsx",
      expected: adminPageTemplate,
    },
  ];

  log.info("Checking admin route files...");

  let allUpToDate = true;

  for (const file of files) {
    if (!existsSync(file.path)) {
      mkdirSync(join(file.path, ".."), { recursive: true });
      writeFileSync(file.path, file.expected, "utf8");
      log.success(`${file.displayPath} — created`);
      allUpToDate = false;
    } else {
      const current = readFileSync(file.path, "utf8");
      if (current === file.expected) {
        log.success(`${file.displayPath} — up to date`);
      } else {
        writeFileSync(file.path, file.expected, "utf8");
        log.step(`${file.displayPath} — updated`);
        allUpToDate = false;
      }
    }
  }

  log.blank();
  if (allUpToDate) {
    log.info("Admin routes are current.");
  } else {
    log.info("Admin routes have been updated.");
  }
  log.blank();
}
