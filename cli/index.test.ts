import { describe, expect, it } from 'vitest';

/**
 * Tests for the CLI argument parser extracted from index.ts.
 * We test the parsing logic directly rather than spawning a process.
 */

function parseArgs(argv: string[]): { command: string | null; flags: Record<string, string | boolean> } {
  const args = argv.slice(2);
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
      if (arg === 'types:gen') {
        command = 'types:gen';
      } else {
        command = arg;
      }
    }
  }

  return { command, flags };
}

describe('parseArgs', () => {
  it('parses bare command', () => {
    const { command, flags } = parseArgs(['node', 'cli', 'validate']);
    expect(command).toBe('validate');
    expect(flags).toEqual({});
  });

  it('parses types:gen as single command', () => {
    const { command } = parseArgs(['node', 'cli', 'types:gen']);
    expect(command).toBe('types:gen');
  });

  it('parses --help flag', () => {
    const { flags } = parseArgs(['node', 'cli', '--help']);
    expect(flags.help).toBe(true);
  });

  it('parses -h shorthand', () => {
    const { flags } = parseArgs(['node', 'cli', '-h']);
    expect(flags.help).toBe(true);
  });

  it('parses --version flag', () => {
    const { flags } = parseArgs(['node', 'cli', '--version']);
    expect(flags.version).toBe(true);
  });

  it('parses -v shorthand', () => {
    const { flags } = parseArgs(['node', 'cli', '-v']);
    expect(flags.version).toBe(true);
  });

  it('parses --yes flag', () => {
    const { command, flags } = parseArgs(['node', 'cli', 'init', '--yes']);
    expect(command).toBe('init');
    expect(flags.yes).toBe(true);
  });

  it('parses -y shorthand', () => {
    const { flags } = parseArgs(['node', 'cli', 'init', '-y']);
    expect(flags.yes).toBe(true);
  });

  it('parses --port with space', () => {
    const { command, flags } = parseArgs(['node', 'cli', 'dev', '--port', '4000']);
    expect(command).toBe('dev');
    expect(flags.port).toBe('4000');
  });

  it('parses --port= with equals', () => {
    const { flags } = parseArgs(['node', 'cli', 'dev', '--port=4000']);
    expect(flags.port).toBe('4000');
  });

  it('returns null command when no command given', () => {
    const { command } = parseArgs(['node', 'cli']);
    expect(command).toBeNull();
  });

  it('returns null command with only flags', () => {
    const { command, flags } = parseArgs(['node', 'cli', '--help']);
    expect(command).toBeNull();
    expect(flags.help).toBe(true);
  });

  it('parses command-specific help', () => {
    const { command, flags } = parseArgs(['node', 'cli', 'init', '--help']);
    expect(command).toBe('init');
    expect(flags.help).toBe(true);
  });
});
