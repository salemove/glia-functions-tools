# Handoff: Template machinery consolidation

## Goal

Reduce 2,980 lines across 9 template-related modules to ~600. The current shape is an abandoned consolidation: `unified-template-manager.js` was meant to replace `template-manager.js`, but both survive, and the registry sits between them as an overbuilt index.

## Current state (as of branch teardown/secure-correct-smaller)

| Module | Lines | Imported by |
|--------|-------|-------------|
| template-registry.js | 653 | 3 |
| unified-template-manager.js | 575 | 10 |
| project-template-manager.js | 353 | 1 |
| package-template-manager.js | 339 | 2 |
| dependency-registry.js | 318 | 1 |
| applet-template-manager.js | 262 | 1 |
| template-manager.js | 166 | 13 (most-imported) |
| component-detector.js | 163 | 1 |
| template-engine.js | 151 | 4 |

## What should survive

- `template-engine.js` (Handlebars + simple `{{var}}` substitution) — the only module that touches template content. Keep as-is.
- One manager that:
  - Discovers templates in `src/templates/{applets,projects}`
  - Reads `template.json` metadata
  - Resolves inheritance (`extends`)
  - Scaffolds files to an output directory with variable substitution
  - Generates a `glia-project.json` manifest when the template declares one
- The KV validation helpers moved to `api.js` (done), so `component-detector.js` only detects files; it can inline into the single manager if small enough.

## What can go

- `template-manager.js` — the 13 import sites all call `getTemplateDir()` or `listTemplates()`, which `unified-template-manager.js` also provides. Migrate callers then delete.
- `project-template-manager.js` — wraps `unified-template-manager.js` for `init` specifically. Inline it.
- `package-template-manager.js` — generates `package.json` for a scaffolded project. Merge into the single manager.
- `applet-template-manager.js` — thin wrapper over the registry + file copy. Merge.
- `dependency-registry.js` — a static map of npm packages categorised by purpose (api clients, AI/ML, testing...). The templates already declare their own dependencies in `template.json`. If nothing reads the registry at runtime, delete it. If something does, keep it as a data file, not a module.

## Risks

- **Every `init`, every `create-applet`, every export-handler scaffold** touches this stack. The test coverage for templates is now good (applet-template-manager.test.js, template-registry.test.js, template-engine.test.js, unified-template-manager.test.js all pass), so regressions are catchable, but the blast radius is wide.
- The `template-registry.js` tests use `setBaseTemplatePaths()` and `clearTemplateRegistryCache()` — any replacement must provide these or the tests need rewriting.

## Suggested approach

1. Make `unified-template-manager.js` the single import target. Migrate every consumer of `template-manager.js` to it.
2. Inline `project-template-manager.js`, `package-template-manager.js` and `applet-template-manager.js` into it or into `template-registry.js`.
3. Move `dependency-registry.js` to a JSON data file if it is still read, or delete it.
4. Run `npm test` after each merge. The tests are the safety net.

## Acceptance

`npm run verify` green. No template regression: `glia init --template basic-function --output /tmp/test` produces a working project, and `create-applet --template basic-html --output /tmp/test-applet` produces a deployable applet.
