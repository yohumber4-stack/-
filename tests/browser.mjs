// Resolves a Chrome/Chromium executable for the headless harness.
// Order: $CHROME_PATH, $CHROME_BIN, ~/.agent-browser/browsers, Playwright's own cache, then common install paths.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright-core';

const COMMON_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/opt/google/chrome/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

export const NO_BROWSER_MESSAGE = [
  '[harness] skipped: no Chrome/Chromium executable found.',
  '[harness] set CHROME_PATH (or CHROME_BIN) to a Chrome/Chromium binary, or install one of: google-chrome, chromium, chromium-browser.',
].join('\n');

function isExecutableFile(p) {
  try {
    if (!fs.statSync(p).isFile()) return false;
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// Same layout the harness used before, but only when the directory exists.
function agentBrowserCandidates() {
  try {
    const dir = path.join(os.homedir(), '.agent-browser/browsers');
    return fs
      .readdirSync(dir)
      .filter((d) => d.startsWith('chrome'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((d) => path.join(dir, d, 'chrome'));
  } catch {
    return [];
  }
}

function playwrightCandidate() {
  try {
    return chromium.executablePath();
  } catch {
    return undefined;
  }
}

export function findChrome() {
  for (const name of ['CHROME_PATH', 'CHROME_BIN']) {
    const p = process.env[name];
    if (!p) continue;
    if (isExecutableFile(p)) return p;
    console.warn(`[harness] ignoring ${name}=${p}: not an executable file`);
  }
  const candidates = [...agentBrowserCandidates(), playwrightCandidate(), ...COMMON_PATHS];
  return candidates.find((p) => p && isExecutableFile(p));
}
