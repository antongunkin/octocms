#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * OctoCMS CLI — command-line tools for managing an OctoCMS project.
 *
 * Commands:
 *   init             Initialize OctoCMS in a Next.js project
 *   dev              Start development server with config watching
 *   types:gen        Generate TypeScript types from next.config.ts
 *   embeddings:gen   Generate cms/__generated__/embeddings.json for the chat agent
 *   validate         Validate all content entries against the schema
 *   update           Regenerate admin route files
 *   agent-docs       Inject AI agent doc links into AGENTS.md
 *
 * Usage:
 *   octocms <command> [options]
 *   octocms --help
 *   octocms --version
 */

import { fmt, log } from './lib/logger';
import { resolveProjectRoot } from './lib/project';
import { version as VERSION } from '../package.json';

const HELP = `
  ${fmt.bold('OctoCMS CLI')} v${VERSION}

  Usage: octocms <command> [options]

  ${fmt.bold('Commands:')}
    init             Initialize OctoCMS in a Next.js project
    dev              Start development server with config watching
    types:gen        Generate TypeScript types from next.config.ts
    embeddings:gen   Generate cms/__generated__/embeddings.json for the chat agent
    validate         Validate all content entries against the schema
    update           Regenerate admin route files
    agent-docs       Inject AI agent doc links into AGENTS.md

  ${fmt.bold('Options:')}
    --help      Show this help message
    --version   Show version number

  Run ${fmt.cyan('octocms <command> --help')} for command-specific help.
`;

const COMMAND_HELP: Record<string, string> = {
  init: `
  ${fmt.bold('octocms init')} — Initialize OctoCMS in a Next.js project

  Creates next.config.ts, admin route files, demo content, and updates
  next.config.ts and tsconfig.json with required configuration.

  ${fmt.bold('Usage:')} octocms init [options]

  ${fmt.bold('Options:')}
    --yes, -y   Accept all defaults (non-interactive)
    --help      Show this help message
`,
  dev: `
  ${fmt.bold('octocms dev')} — Start development server with config watching

  Spawns Next.js dev server and watches next.config.ts. When the config
  changes, types are automatically regenerated.

  ${fmt.bold('Usage:')} octocms dev [options]

  ${fmt.bold('Options:')}
    --port <n>  Port number (default: 3000)
    --help      Show this help message
`,
  'types:gen': `
  ${fmt.bold('octocms types:gen')} — Generate TypeScript types from next.config.ts

  Produces cms/__generated__/types.ts, enums.ts, content.d.ts, and index.ts.
  Validates the config before generating.

  ${fmt.bold('Usage:')} octocms types:gen

  ${fmt.bold('Options:')}
    --help      Show this help message
`,
  'embeddings:gen': `
  ${fmt.bold('octocms embeddings:gen')} — Generate cms/__generated__/embeddings.json

  Walks every content entry, embeds new/changed entries via the local
  @huggingface/transformers model (Xenova/bge-small-en-v1.5, 384 dims), and
  writes the merged store. Re-running on unchanged content is a fast no-op.

  Requires the @huggingface/transformers peer dep installed.

  ${fmt.bold('Usage:')} octocms embeddings:gen

  ${fmt.bold('Options:')}
    --help      Show this help message
`,
  validate: `
  ${fmt.bold('octocms validate')} — Validate all content entries against the schema

  Reads every JSON file in cms/content/, validates structure, field types,
  required fields, select option values, reference targets, and companion files.

  ${fmt.bold('Usage:')} octocms validate

  ${fmt.bold('Options:')}
    --help      Show this help message
`,
  'agent-docs': `
  ${fmt.bold('octocms agent-docs')} — Inject AI agent doc links into AGENTS.md

  Creates AGENTS.md if it doesn't exist, or appends the OctoCMS section
  if the file exists but doesn't reference the agent docs yet.

  ${fmt.bold('Usage:')} octocms agent-docs

  ${fmt.bold('Options:')}
    --help      Show this help message
`,
  update: `
  ${fmt.bold('octocms update')} — Regenerate admin route files

  Ensures src/app/cms/layout.tsx and the catch-all page re-export are
  up-to-date with the latest OctoCMS version.

  ${fmt.bold('Usage:')} octocms update

  ${fmt.bold('Options:')}
    --help      Show this help message
`,
};

function parseArgs(argv: string[]): { command: string | null; flags: Record<string, string | boolean> } {
  const args = argv.slice(2); // skip node + script path
  const flags: Record<string, string | boolean> = {};
  let command: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg === '--version' || arg === '-v') {
      flags.version = true;
    } else if (arg === '--yes' || arg === '-y') {
      flags.yes = true;
    } else if (arg === '--port') {
      flags.port = args[++i] ?? '';
    } else if (arg.startsWith('--port=')) {
      flags.port = arg.slice(7);
    } else if (!arg.startsWith('-') && !command) {
      // Handle compound commands as single tokens
      if (arg === 'types:gen' || arg === 'embeddings:gen' || arg === 'agent-docs') {
        command = arg;
      } else {
        command = arg;
      }
    }
  }

  return { command, flags };
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv);

  if (flags.version) {
    console.log(VERSION);
    return;
  }

  if (!command || flags.help) {
    if (command && COMMAND_HELP[command]) {
      console.log(COMMAND_HELP[command]);
    } else {
      console.log(HELP);
    }
    return;
  }

  if (COMMAND_HELP[command] && flags.help) {
    console.log(COMMAND_HELP[command]);
    return;
  }

  try {
    switch (command) {
      case 'init': {
        // init doesn't need an existing project root — use cwd
        const { initCommand } = await import('./commands/init');
        await initCommand(process.cwd(), { yes: flags.yes === true });
        break;
      }
      case 'dev': {
        const projectRoot = resolveProjectRoot();
        const { devCommand } = await import('./commands/dev');
        const port = flags.port ? Number(flags.port) : undefined;
        await devCommand(projectRoot, { port });
        break;
      }
      case 'types:gen': {
        const projectRoot = resolveProjectRoot();
        const { typesGenCommand } = await import('./commands/typesGen');
        await typesGenCommand(projectRoot);
        break;
      }
      case 'embeddings:gen': {
        const projectRoot = resolveProjectRoot();
        const { embeddingsGenCommand } = await import('./commands/embeddingsGen');
        await embeddingsGenCommand(projectRoot);
        break;
      }
      case 'validate': {
        const projectRoot = resolveProjectRoot();
        const { validateCommand } = await import('./commands/validate');
        await validateCommand(projectRoot);
        break;
      }
      case 'update': {
        const projectRoot = resolveProjectRoot();
        const { updateCommand } = await import('./commands/update');
        await updateCommand(projectRoot);
        break;
      }
      case 'agent-docs': {
        const projectRoot = resolveProjectRoot();
        const { agentDocsCommand } = await import('./commands/agentDocs');
        await agentDocsCommand(projectRoot);
        break;
      }
      default:
        log.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exitCode = 1;
    }
  } catch (e) {
    log.error((e as Error).message);
    process.exitCode = 1;
  }
}

main();
