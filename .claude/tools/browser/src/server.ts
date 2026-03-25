/**
 * Crucible Browser Daemon Server
 *
 * Persistent headless Chromium daemon.
 * Key design decisions:
 * - Long-lived browser process (avoid 3-5s cold start per command)
 * - HTTP API on localhost (simple, debuggable, no WebSocket complexity)
 * - Ref system (@e1, @e2) instead of CSS selectors (ARIA-based, CSP-safe)
 * - Auto-shutdown after idle timeout (resource cleanup)
 */

import { chromium, type Browser, type Page, type BrowserContext, type Locator } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { StateFile, Ref, SnapshotResult, CommandResult, ScreenshotResult } from './types';

// --- Configuration ---
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const STATE_DIR = join(process.env.HOME || '~', '.crucible');
const STATE_FILE = join(STATE_DIR, 'browser.json');
const CONSOLE_BUFFER_SIZE = 500;
const VERSION = '0.1.0';

// --- State ---
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let refs: Map<string, { locator: Locator; role: string; name: string }> = new Map();
let consoleMessages: Array<{ type: string; text: string; timestamp: string }> = [];

// --- Helpers ---
function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    console.log('[crucible-browse] Idle timeout reached, shutting down...');
    await shutdown();
    process.exit(0);
  }, IDLE_TIMEOUT_MS);
}

async function ensureBrowser(): Promise<Page> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'CrucibleBrowser/0.1 (headless)',
    });
    page = await context.newPage();

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
      });
      if (consoleMessages.length > CONSOLE_BUFFER_SIZE) {
        consoleMessages = consoleMessages.slice(-CONSOLE_BUFFER_SIZE);
      }
    });
  }
  if (!page) {
    page = await context!.newPage();
  }
  return page;
}

async function shutdown() {
  if (browser) {
    await browser.close().catch(() => { });
    browser = null;
    context = null;
    page = null;
  }
}

/**
 * Build refs from ARIA snapshot
 * Uses Playwright's ariaSnapshot() API (v1.49+):
 * - No CSP conflicts
 * - No framework hydration issues
 * - No Shadow DOM problems
 * - Parses YAML-like ARIA tree output into structured refs
 */
async function buildRefs(currentPage: Page): Promise<Ref[]> {
  refs.clear();
  const result: Ref[] = [];
  let elementIdx = 1;

  // Use ariaSnapshot which returns YAML-like ARIA tree
  const ariaText = await currentPage.locator('body').ariaSnapshot();
  if (!ariaText) return result;

  const interactiveRoles = [
    'button', 'link', 'textbox', 'checkbox', 'radio',
    'combobox', 'menuitem', 'tab', 'switch', 'slider',
    'searchbox', 'spinbutton',
  ];

  // Parse lines like: - link "Learn more":
  // or: - button "Submit"
  // or: - textbox "Email" [value=""]
  const lines = ariaText.split('\n');
  for (const line of lines) {
    const match = line.match(/- (\w+)\s+"([^"]+)"/);
    if (!match) continue;

    const [, role, name] = match;
    if (interactiveRoles.includes(role) && name) {
      const refId = `@e${elementIdx++}`;
      const locator = currentPage.getByRole(role as any, { name });
      refs.set(refId, { locator, role, name });
      result.push({
        id: refId,
        role,
        name,
        locatorMethod: 'getByRole',
        locatorArgs: { role, name },
      });
    }
  }

  return result;
}

async function resolveRef(refId: string): Promise<Locator> {
  const entry = refs.get(refId);
  if (!entry) {
    throw new Error(`Ref ${refId} not found. Run 'snapshot' to get fresh refs.`);
  }
  // Staleness check
  const count = await entry.locator.count();
  if (count === 0) {
    refs.delete(refId);
    throw new Error(
      `Ref ${refId} is stale — element no longer exists. Run 'snapshot' to get fresh refs.`
    );
  }
  return entry.locator;
}

// --- Command Handlers ---
async function handleCommand(cmd: string, args: Record<string, any>): Promise<CommandResult> {
  const start = Date.now();
  resetIdleTimer();

  try {
    const p = await ensureBrowser();
    let data: unknown;

    switch (cmd) {
      // === READ commands ===
      case 'snapshot': {
        const refList = await buildRefs(p);
        const result: SnapshotResult = {
          url: p.url(),
          title: await p.title(),
          refs: refList,
          timestamp: new Date().toISOString(),
        };
        data = result;
        break;
      }

      case 'screenshot': {
        const screenshotDir = args.dir || join(STATE_DIR, 'screenshots');
        mkdirSync(screenshotDir, { recursive: true });
        const filename = `screenshot-${Date.now()}.png`;
        const filepath = join(screenshotDir, filename);
        await p.screenshot({ path: filepath, fullPage: args.fullPage ?? false });
        const viewport = p.viewportSize();
        const result: ScreenshotResult = {
          path: filepath,
          width: viewport?.width ?? 1280,
          height: viewport?.height ?? 720,
          timestamp: new Date().toISOString(),
        };
        data = result;
        break;
      }

      case 'text': {
        const selector = args.ref ? undefined : args.selector;
        if (args.ref) {
          const locator = await resolveRef(args.ref);
          data = await locator.textContent();
        } else {
          data = await p.textContent(selector || 'body');
        }
        break;
      }

      case 'html': {
        data = await p.content();
        break;
      }

      case 'url': {
        data = p.url();
        break;
      }

      case 'title': {
        data = await p.title();
        break;
      }

      case 'console': {
        data = consoleMessages.slice(-(args.limit || 50));
        break;
      }

      case 'tabs': {
        const pages = context?.pages() || [];
        data = pages.map((pg, i) => ({
          index: i,
          url: pg.url(),
          title: '', // title requires async, skip for speed
          active: pg === page,
        }));
        break;
      }

      // === WRITE commands ===
      case 'goto': {
        const url = args.url;
        if (!url) throw new Error('goto requires url parameter');
        const response = await p.goto(url, {
          waitUntil: args.waitUntil || 'domcontentloaded',
          timeout: args.timeout || 30000,
        });
        data = {
          url: p.url(),
          status: response?.status(),
          ok: response?.ok(),
        };
        break;
      }

      case 'click': {
        if (args.ref) {
          const locator = await resolveRef(args.ref);
          await locator.click({ timeout: args.timeout || 5000 });
        } else if (args.selector) {
          await p.click(args.selector, { timeout: args.timeout || 5000 });
        } else {
          throw new Error('click requires ref or selector parameter');
        }
        data = { clicked: args.ref || args.selector };
        break;
      }

      case 'fill': {
        if (args.ref) {
          const locator = await resolveRef(args.ref);
          await locator.fill(args.value || '');
        } else if (args.selector) {
          await p.fill(args.selector, args.value || '');
        } else {
          throw new Error('fill requires ref or selector parameter');
        }
        data = { filled: args.ref || args.selector, value: args.value };
        break;
      }

      case 'press': {
        const key = args.key;
        if (!key) throw new Error('press requires key parameter');
        if (args.ref) {
          const locator = await resolveRef(args.ref);
          await locator.press(key);
        } else {
          await p.keyboard.press(key);
        }
        data = { pressed: key };
        break;
      }

      case 'select': {
        if (args.ref) {
          const locator = await resolveRef(args.ref);
          await locator.selectOption(args.value || '');
        } else if (args.selector) {
          await p.selectOption(args.selector, args.value || '');
        }
        data = { selected: args.value };
        break;
      }

      case 'hover': {
        if (args.ref) {
          const locator = await resolveRef(args.ref);
          await locator.hover();
        } else if (args.selector) {
          await p.hover(args.selector);
        }
        data = { hovered: args.ref || args.selector };
        break;
      }

      case 'scroll': {
        const direction = args.direction || 'down';
        const amount = args.amount || 500;
        if (direction === 'down') {
          await p.evaluate((px: number) => window.scrollBy(0, px), amount);
        } else if (direction === 'up') {
          await p.evaluate((px: number) => window.scrollBy(0, -px), amount);
        }
        data = { scrolled: direction, amount };
        break;
      }

      case 'back': {
        await p.goBack();
        data = { url: p.url() };
        break;
      }

      case 'forward': {
        await p.goForward();
        data = { url: p.url() };
        break;
      }

      case 'reload': {
        await p.reload();
        data = { url: p.url() };
        break;
      }

      // === META commands ===
      case 'health': {
        data = {
          status: 'ok',
          browser: browser?.isConnected() ?? false,
          url: page?.url() ?? null,
          refCount: refs.size,
          consoleMessages: consoleMessages.length,
          uptime_ms: Date.now() - serverStartTime,
          version: VERSION,
        };
        break;
      }

      case 'shutdown': {
        await shutdown();
        data = { status: 'shutdown' };
        // Delay exit to send response
        setTimeout(() => process.exit(0), 100);
        break;
      }

      default:
        throw new Error(`Unknown command: ${cmd}. Valid commands: snapshot, screenshot, text, html, url, title, console, tabs, goto, click, fill, press, select, hover, scroll, back, forward, reload, health, shutdown`);
    }

    return {
      ok: true,
      command: cmd,
      data,
      duration_ms: Date.now() - start,
    };
  } catch (err: any) {
    return {
      ok: false,
      command: cmd,
      error: err.message,
      duration_ms: Date.now() - start,
    };
  }
}

// --- HTTP Server ---
const serverStartTime = Date.now();

function pickPort(): number {
  return Math.floor(Math.random() * 50000) + 10000;
}

const PORT = pickPort();
const TOKEN = crypto.randomUUID();

const server = Bun.serve({
  port: PORT,
  hostname: 'localhost', // Security: localhost only
  async fetch(req) {
    // Auth check
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${TOKEN}`) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'POST only' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await req.json();
      const { command, args = {} } = body;
      const result = await handleCommand(command, args);
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
});

// Write state file
mkdirSync(STATE_DIR, { recursive: true });
const state: StateFile = {
  pid: process.pid,
  port: PORT,
  token: TOKEN,
  startedAt: new Date().toISOString(),
  version: VERSION,
};
writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

console.log(`[crucible-browse] Server started on localhost:${PORT} (PID: ${process.pid})`);
resetIdleTimer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[crucible-browse] Shutting down...');
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});
