/* eslint-disable no-console */
/** ANSI color helpers for CLI output. No external dependencies. */

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

export const fmt = {
  bold: (s: string) => `${BOLD}${s}${RESET}`,
  dim: (s: string) => `${DIM}${s}${RESET}`,
  red: (s: string) => `${RED}${s}${RESET}`,
  green: (s: string) => `${GREEN}${s}${RESET}`,
  yellow: (s: string) => `${YELLOW}${s}${RESET}`,
  cyan: (s: string) => `${CYAN}${s}${RESET}`,
};

export const log = {
  info: (msg: string) => console.log(`  ${msg}`),
  success: (msg: string) => console.log(`  ${fmt.green('✓')} ${msg}`),
  warn: (msg: string) => console.log(`  ${fmt.yellow('⚠')} ${msg}`),
  error: (msg: string) => console.error(`  ${fmt.red('✗')} ${msg}`),
  step: (msg: string) => console.log(`  ${fmt.cyan('↻')} ${msg}`),
  blank: () => console.log(),
  header: (title: string) => {
    console.log();
    console.log(`  ${fmt.bold(`OctoCMS`)} — ${title}`);
    console.log();
  },
};
