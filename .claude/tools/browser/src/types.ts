// Crucible Browser Daemon Types

export interface StateFile {
  pid: number;
  port: number;
  token: string;
  startedAt: string;
  version: string;
}

export interface Ref {
  id: string;          // @e1, @e2, @c1, ...
  role: string;        // button, link, textbox, ...
  name: string;        // accessible name
  locatorMethod: string;  // getByRole, getByText, ...
  locatorArgs: Record<string, string>;
}

export interface SnapshotResult {
  url: string;
  title: string;
  refs: Ref[];
  timestamp: string;
}

export interface CommandResult {
  ok: boolean;
  command: string;
  data?: unknown;
  error?: string;
  duration_ms: number;
}

export interface ScreenshotResult {
  path: string;
  width: number;
  height: number;
  timestamp: string;
}

// Command types categorized by side effects
export type ReadCommand =
  | 'snapshot'
  | 'screenshot'
  | 'text'
  | 'html'
  | 'console'
  | 'url'
  | 'title'
  | 'tabs';

export type WriteCommand =
  | 'goto'
  | 'click'
  | 'fill'
  | 'press'
  | 'select'
  | 'hover'
  | 'scroll'
  | 'back'
  | 'forward'
  | 'reload';

export type MetaCommand =
  | 'health'
  | 'shutdown';
