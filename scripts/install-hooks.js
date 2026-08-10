#!/usr/bin/env node

/**
 * Install the git hooks that act as this repository's verification gate.
 *
 * There is no CI here, so `npm run verify` on pre-push is the gate. .git/hooks
 * is not versioned, which is why the hooks live in scripts/hooks/ and are
 * installed by this script.
 *
 * Two installation strategies, because a globally configured core.hooksPath
 * takes precedence over .git/hooks and would make a symlink there inert:
 *
 *   - No global hooksPath: symlink scripts/hooks/pre-push into .git/hooks.
 *   - Global hooksPath set: point core.hooksPath at scripts/hooks for this
 *     repository only. The hooks there chain to the global directory, so
 *     nothing already installed stops working.
 *
 * Usage:
 *   node scripts/install-hooks.js            # install
 *   node scripts/install-hooks.js --status   # report, change nothing
 *   node scripts/install-hooks.js --uninstall
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const HOOKS_SOURCE = path.join(REPO_ROOT, 'scripts', 'hooks');
const RELATIVE_HOOKS_SOURCE = 'scripts/hooks';
const MANAGED_HOOKS = ['pre-push', 'pre-commit'];

/**
 * Read a git config value, returning null when it is unset.
 *
 * @param {string[]} args - Arguments after `git config`
 * @returns {string|null} The trimmed value, or null
 */
function gitConfig(args) {
  try {
    return execFileSync('git', ['config', ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Resolve the absolute path of this repository's .git directory.
 *
 * @returns {string} Absolute path to the git directory
 */
function gitDir() {
  const dir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  }).trim();
  return dir;
}

/**
 * Make sure every hook in scripts/hooks is executable. Git silently ignores a
 * hook without the execute bit, which is a confusing way to lose a gate.
 */
function ensureExecutable() {
  for (const entry of fs.readdirSync(HOOKS_SOURCE)) {
    const file = path.join(HOOKS_SOURCE, entry);
    fs.chmodSync(file, 0o755);
  }
}

function report() {
  const localPath = gitConfig(['--local', '--get', 'core.hooksPath']);
  const globalPath = gitConfig(['--global', '--get', 'core.hooksPath']);
  const effective = gitConfig(['--get', 'core.hooksPath']);

  console.log('git hooks status');
  console.log(`  core.hooksPath (local):  ${localPath ?? '(unset)'}`);
  console.log(`  core.hooksPath (global): ${globalPath ?? '(unset)'}`);
  console.log(`  effective:               ${effective ?? '.git/hooks'}`);

  const viaConfig = localPath === RELATIVE_HOOKS_SOURCE;
  const hookFile = path.join(gitDir(), 'hooks', 'pre-push');
  const viaSymlink = fs.existsSync(hookFile);

  if (viaConfig) {
    console.log('  pre-push:                installed (repo-local core.hooksPath)');
  } else if (viaSymlink && !globalPath) {
    console.log('  pre-push:                installed (.git/hooks symlink)');
  } else if (viaSymlink && globalPath) {
    console.log('  pre-push:                INERT - .git/hooks is shadowed by core.hooksPath');
  } else {
    console.log('  pre-push:                not installed');
  }
}

function install() {
  ensureExecutable();

  const globalPath = gitConfig(['--global', '--get', 'core.hooksPath']);
  const systemPath = gitConfig(['--system', '--get', 'core.hooksPath']);
  const inherited = globalPath || systemPath;

  if (inherited) {
    // .git/hooks would be ignored, so take over core.hooksPath for this repo.
    execFileSync('git', ['config', '--local', 'core.hooksPath', RELATIVE_HOOKS_SOURCE], {
      cwd: REPO_ROOT,
      stdio: 'inherit'
    });
    console.log(`Installed hooks via repo-local core.hooksPath=${RELATIVE_HOOKS_SOURCE}`);
    console.log(`Hooks inherited from ${inherited} are still chained, not replaced.`);
    console.log('Undo with: git config --local --unset core.hooksPath');
    return;
  }

  const hooksDir = path.join(gitDir(), 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  for (const hook of MANAGED_HOOKS) {
    const target = path.join(hooksDir, hook);
    const source = path.join(HOOKS_SOURCE, hook);

    if (fs.existsSync(target) || fs.lstatSync(target, { throwIfNoEntry: false })) {
      const existing = fs.lstatSync(target);
      if (existing.isSymbolicLink() && fs.readlinkSync(target) === path.relative(hooksDir, source)) {
        continue;
      }
      fs.renameSync(target, `${target}.bak`);
      console.log(`Moved existing ${hook} hook to ${hook}.bak`);
    }

    fs.symlinkSync(path.relative(hooksDir, source), target);
    console.log(`Installed ${hook} -> ${RELATIVE_HOOKS_SOURCE}/${hook}`);
  }

  console.log('Undo by deleting the symlinks in .git/hooks.');
}

function uninstall() {
  if (gitConfig(['--local', '--get', 'core.hooksPath']) === RELATIVE_HOOKS_SOURCE) {
    execFileSync('git', ['config', '--local', '--unset', 'core.hooksPath'], { cwd: REPO_ROOT });
    console.log('Removed repo-local core.hooksPath.');
  }

  const hooksDir = path.join(gitDir(), 'hooks');
  for (const hook of MANAGED_HOOKS) {
    const target = path.join(hooksDir, hook);
    const stats = fs.lstatSync(target, { throwIfNoEntry: false });
    if (stats?.isSymbolicLink()) {
      fs.unlinkSync(target);
      console.log(`Removed ${hook} symlink.`);
    }
  }
}

const mode = process.argv[2];
if (mode === '--status') {
  report();
} else if (mode === '--uninstall') {
  uninstall();
} else {
  install();
  console.log('');
  report();
}
