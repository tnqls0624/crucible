#!/usr/bin/env bun
/**
 * Crucible Browser CLI — Thin client for the browser daemon
 *
 * Architecture:
 * 1. Read state file → find running daemon
 * 2. If no daemon → spawn one in background
 * 3. Send HTTP POST → receive JSON result
 * 4. Print result to stdout (for Claude to parse)
 *
 * Usage:
 *   crucible-browse goto --url https://example.com
 *   crucible-browse snapshot
 *   crucible-browse click --ref @e3
 *   crucible-browse fill --ref @e5 --value "hello"
 *   crucible-browse screenshot
 *   crucible-browse health
 *   crucible-browse shutdown
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import type { StateFile, CommandResult } from './types';

const STATE_DIR = join(process.env.HOME || '~', '.crucible');
const STATE_FILE = join(STATE_DIR, 'browser.json');
const SERVER_SCRIPT = join(import.meta.dir, 'server.ts');
const MAX_STARTUP_WAIT_MS = 10000;
const POLL_INTERVAL_MS = 200;

// --- State File ---
function readState(): StateFile | null {
  try {
    if (!existsSync(STATE_FILE)) return null;
    const raw = readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(raw) as StateFile;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // Signal 0 = check existence
    return true;
  } catch {
    return false;
  }
}

// --- Daemon Management ---
async function startDaemon(): Promise<StateFile> {
  console.error('[crucible-browse] Starting browser daemon...');

  const child = spawn('bun', ['run', SERVER_SCRIPT], {
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, BUN_INSTALL: join(process.env.HOME || '~', '.bun') },
  });
  child.unref();

  // Wait for state file to appear
  const start = Date.now();
  while (Date.now() - start < MAX_STARTUP_WAIT_MS) {
    await Bun.sleep(POLL_INTERVAL_MS);
    const state = readState();
    if (state && isProcessAlive(state.pid)) {
      console.error(`[crucible-browse] Daemon ready on port ${state.port} (${Date.now() - start}ms)`);
      return state;
    }
  }

  throw new Error('Failed to start browser daemon within timeout');
}

async function getDaemon(): Promise<StateFile> {
  const state = readState();

  if (state && isProcessAlive(state.pid)) {
    return state;
  }

  // No running daemon, start one
  return startDaemon();
}

// --- HTTP Client ---
async function sendCommand(
  state: StateFile,
  command: string,
  args: Record<string, any>
): Promise<CommandResult> {
  const url = `http://localhost:${state.port}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.token}`,
    },
    body: JSON.stringify({ command, args }),
  });

  return (await response.json()) as CommandResult;
}

// --- Argument Parsing ---
function parseArgs(argv: string[]): { command: string; args: Record<string, any> } {
  const [command, ...rest] = argv;

  if (!command) {
    printUsage();
    process.exit(1);
  }

  const args: Record<string, any> = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith('--')) {
        // Handle boolean-like values
        if (next === 'true') args[key] = true;
        else if (next === 'false') args[key] = false;
        else if (!isNaN(Number(next))) args[key] = Number(next);
        else args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else if (arg.startsWith('@')) {
      // Shorthand: @e3 → ref: @e3
      args.ref = arg;
    }
  }

  return { command, args };
}

function printUsage() {
  console.log(`
crucible-browse — Persistent browser for Crucible QA

NAVIGATION:
  goto --url <url>              Navigate to URL
  back                          Go back
  forward                       Go forward
  reload                        Reload page

INSPECTION:
  snapshot                      Get ARIA tree with @refs
  screenshot [--dir <path>]     Take screenshot
  text [--ref @e1]              Get text content
  html                          Get full HTML
  url                           Get current URL
  title                         Get page title
  console [--limit 50]          Get console messages
  tabs                          List open tabs

INTERACTION:
  click --ref @e1               Click element by ref
  fill --ref @e2 --value "hi"   Fill input by ref
  press --key Enter             Press keyboard key
  select --ref @e3 --value "x"  Select dropdown option
  hover --ref @e1               Hover over element
  scroll [--direction down] [--amount 500]

DAEMON:
  health                        Check daemon status
  shutdown                      Stop daemon

EXAMPLES:
  crucible-browse goto --url <app-base-url>
  crucible-browse snapshot
  crucible-browse click @e3
  crucible-browse fill @e5 --value "user@test.com"
  crucible-browse screenshot --dir ./qa-screenshots
`);
}

// --- Main ---
async function main() {
  const { command, args } = parseArgs(process.argv.slice(2));

  if (command === 'help' || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  try {
    const state = await getDaemon();
    const result = await sendCommand(state, command, args);

    if (result.ok) {
      // Format output for Claude readability
      if (command === 'snapshot' && result.data) {
        const snap = result.data as any;
        console.log(`URL: ${snap.url}`);
        console.log(`Title: ${snap.title}`);
        console.log(`\nInteractive Elements (${snap.refs.length}):`);
        for (const ref of snap.refs) {
          console.log(`  ${ref.id}  [${ref.role}]  "${ref.name}"`);
        }
      } else if (command === 'screenshot' && result.data) {
        const ss = result.data as any;
        console.log(`Screenshot saved: ${ss.path}`);
        console.log(`Size: ${ss.width}x${ss.height}`);
      } else if (command === 'console' && result.data) {
        const msgs = result.data as any[];
        for (const msg of msgs) {
          console.log(`[${msg.type}] ${msg.text}`);
        }
      } else if (typeof result.data === 'string') {
        console.log(result.data);
      } else {
        console.log(JSON.stringify(result.data, null, 2));
      }
    } else {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }

    // Show timing for non-trivial commands
    if (result.duration_ms > 50) {
      console.error(`(${result.duration_ms}ms)`);
    }
  } catch (err: any) {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
  }
}

main();
