#!/usr/bin/env node

/**
 * Documentation link checker.
 *
 * Every URL this project prints to a user or embeds in a generated project is a
 * promise that the page exists. There is no CI here, so this runs as part of
 * `npm run verify` and in the pre-push hook: a shipped link cannot rot silently.
 *
 * Scope: git-tracked first-party text files only. node_modules, examples/ and
 * lockfiles are excluded, so third-party README noise never reaches the network.
 *
 * Offline behaviour: if every request fails at the network layer (DNS or connect
 * error) the checker assumes there is no connectivity and passes with a warning
 * rather than blocking a commit on a train.
 *
 * Usage:
 *   node scripts/check-doc-links.js            # check
 *   node scripts/check-doc-links.js --list     # print the URLs, check nothing
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);

/** Files to harvest URLs from, as git pathspecs. */
const PATHSPECS = [
  'src/**',
  'bin/**',
  'mcp-server/*.js',
  'scripts/**',
  'README.md',
  'LICENSE'
];

/** Extensions worth scanning; anything else is binary or noise. */
const SCANNED_EXTENSIONS = new Set(['.js', '.md', '.json', '.html', '.txt', '.yml', '.yaml']);

/**
 * Hosts that are never fetchable and must not be treated as broken links:
 * loopback addresses, documentation placeholders, and schema identifier URIs
 * (a JSON Schema `$id` is a name, not a location).
 */
const SKIPPED_HOST_PATTERNS = [
  /^localhost(:|$)/,
  /^127\.0\.0\.1(:|$)/,
  /^0\.0\.0\.0(:|$)/,
  /(^|\.)example\.(com|org|net)$/,
  /(^|\.)example\d+\.com$/,
  /^json-schema\.org$/,
  /^my-server\.com$/
];

/**
 * Full URLs to skip. These are live API endpoints or schema identifiers rather
 * than documentation: requesting them either needs credentials or means nothing.
 */
const SKIPPED_URL_PATTERNS = [
  /^https?:\/\/api\.(glia|beta\.glia|salemove|openai)\.com/,
  /^https?:\/\/api\.beta\.glia\.com/,
  /^https:\/\/glia\.com\/schemas\//,
  /^https:\/\/www\.gstatic\.com\/generate_204$/
];

/** Requests slower than this are treated as failures. */
const TIMEOUT_MS = 15000;

/** Status codes that prove a page exists even though it refused our request. */
const TOLERATED_STATUSES = new Set([401, 403, 405, 429]);

/**
 * Collect the git-tracked files worth scanning.
 *
 * @returns {string[]} Repo-relative file paths
 */
function trackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z', '--', ...PATHSPECS], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });

  return output
    .split('\0')
    .filter(Boolean)
    .filter(file => SCANNED_EXTENSIONS.has(path.extname(file)));
}

/**
 * Trim trailing punctuation and template artefacts that the URL regex swallows.
 *
 * @param {string} raw - Raw regex match
 * @returns {string|null} A cleaned URL, or null if it is not checkable
 */
function cleanUrl(raw) {
  let url = raw;

  // Strip prose and code punctuation that cannot end a URL.
  url = url.replace(/[.,;:!?'"`)\]}>]+$/, '');

  // Anything containing an interpolation marker is a URL template, not a URL.
  if (/[$`{}\\]/.test(url)) return null;
  if (url.includes("'") || url.includes('"')) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname.includes('.') && !/^localhost/.test(parsed.host)) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Decide whether a URL should be requested.
 *
 * @param {string} url - A cleaned URL
 * @returns {boolean} True if the URL is a checkable documentation link
 */
function isCheckable(url) {
  if (SKIPPED_URL_PATTERNS.some(pattern => pattern.test(url))) return false;
  const { host } = new URL(url);
  return !SKIPPED_HOST_PATTERNS.some(pattern => pattern.test(host));
}

/**
 * Harvest every checkable URL from the tracked source, remembering where each
 * one was found so failures are actionable.
 *
 * @returns {Map<string, string[]>} URL to the list of `file:line` sites
 */
function collectUrls() {
  const urlPattern = /https?:\/\/[^\s<>()[\]{}"'`,;]+/g;
  const found = new Map();

  for (const file of trackedFiles()) {
    let contents;
    try {
      contents = readFileSync(path.join(REPO_ROOT, file), 'utf8');
    } catch {
      continue;
    }

    contents.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(urlPattern)) {
        const url = cleanUrl(match[0]);
        if (!url || !isCheckable(url)) continue;
        const site = `${file}:${index + 1}`;
        if (found.has(url)) {
          found.get(url).push(site);
        } else {
          found.set(url, [site]);
        }
      }
    });
  }

  return found;
}

/**
 * Request a URL, preferring HEAD and falling back to GET for servers that
 * reject it.
 *
 * @param {string} url - URL to check
 * @returns {Promise<{ok: boolean, status: number|null, error: string|null}>} Result
 */
async function checkUrl(url) {
  for (const method of ['HEAD', 'GET']) {
    let response;
    try {
      response = await fetch(url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': 'glia-functions-tools link checker' }
      });
    } catch (error) {
      // A network-layer failure is not URL-specific; report it as such.
      return { ok: false, status: null, error: error.message || String(error) };
    }

    if (response.ok || TOLERATED_STATUSES.has(response.status)) {
      return { ok: true, status: response.status, error: null };
    }

    // Some servers answer HEAD with 404 but serve the page on GET.
    if (method === 'HEAD') continue;

    return { ok: false, status: response.status, error: null };
  }

  return { ok: false, status: null, error: 'unreachable' };
}

async function main() {
  const urls = collectUrls();
  const sorted = [...urls.keys()].sort();

  if (process.argv.includes('--list')) {
    sorted.forEach(url => console.log(`${url}\n    ${urls.get(url).join(', ')}`));
    console.log(`\n${sorted.length} checkable URL(s).`);
    return;
  }

  if (sorted.length === 0) {
    console.log('check-doc-links: no checkable URLs found.');
    return;
  }

  console.log(`check-doc-links: checking ${sorted.length} URL(s)...`);

  const results = await Promise.all(
    sorted.map(async url => ({ url, ...(await checkUrl(url)) }))
  );

  const broken = results.filter(result => !result.ok && result.status !== null);
  const unreachable = results.filter(result => !result.ok && result.status === null);

  // No URL resolved and every failure was network-level: assume no connectivity.
  if (unreachable.length === results.length) {
    console.warn('check-doc-links: no network connectivity, skipping link check.');
    return;
  }

  unreachable.forEach(({ url, error }) => {
    console.warn(`  ? ${url} (not reached: ${error})`);
    console.warn(`      ${urls.get(url).join(', ')}`);
  });

  if (broken.length > 0) {
    console.error(`\ncheck-doc-links: ${broken.length} broken link(s):`);
    broken.forEach(({ url, status }) => {
      console.error(`  ✗ ${status} ${url}`);
      console.error(`      ${urls.get(url).join(', ')}`);
    });
    process.exit(1);
  }

  const checked = results.length - unreachable.length;
  console.log(`check-doc-links: ${checked} link(s) OK.`);
}

main().catch(error => {
  console.error(`check-doc-links: ${error.message}`);
  process.exit(1);
});
