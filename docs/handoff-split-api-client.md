# Handoff: Split the API client

## Goal

Break `src/lib/api.js` (~3,000 lines, one class) into domain modules over a shared request layer, so each concern is reviewable and testable in isolation.

## Current state (as of branch teardown/secure-correct-smaller)

`GliaApiClient` is a single class with ~40 public methods covering:
- Functions (list, get, create, update, delete)
- Versions (list, create, get, deploy, update, getCode, getEnvVars)
- KV Store (listNamespaces, listPairs, batchOps, get, set, delete, testAndSet + stats)
- Applets (list, listSite, get, create, update, delete, addToSite)
- Scheduled triggers (list, get, create, update, delete)
- Invocation
- Logs

Plus the infrastructure: makeRequest, retry, circuit breaker, cache, token refresh, idempotency keys, redirect handling, request cancellation, prefetch.

## Proposed split

```
src/lib/api/
  index.js          — re-exports GliaApiClient for backward compat
  client.js         — GliaApiClient class: constructor, makeRequest, _prepareHeaders,
                      _generateRequestId, _parseResponseData, _extractResponseMetadata,
                      _handleRateLimit, _handleRequestError, cancel, prefetch
  functions.js      — listFunctions, getFunction, createFunction, updateFunction, deleteFunction
  versions.js       — listVersions, createVersion, getVersion, deployVersion, updateVersion,
                      getVersionCode, getVersionCreationTask, getVersionEnvVars, updateEnvVars
  kv.js             — listKvNamespaces, listKvPairs, batchKvOperations, getKvValue, setKvValue,
                      deleteKvValue, testAndSetKvValue, getFunctionStats, _kvError
  applets.js        — listApplets, listSiteApplets, getApplet, createApplet, updateApplet,
                      deleteApplet, addAppletToSite
  triggers.js       — listScheduledTriggers, getScheduledTrigger, createScheduledTrigger,
                      updateScheduledTrigger, deleteScheduledTrigger
  invoke.js         — invokeFunction, getFunctionLogs
```

Each domain module exports functions that take `(client, ...args)` — or, if you prefer mixins, methods that are assigned to the prototype. The test files split the same way.

## Constraints

- `import GliaApiClient from '../lib/api.js'` must keep working everywhere. The barrel `src/lib/api/index.js` provides this.
- The KV validation helpers (`validateKvNamespace`, `validateKvKey`) are exported from api.js today and imported by `src/commands/kv-store/base.js`. Move them to a standalone `src/lib/kv-validation.js` or keep them in `api/kv.js` and re-export from the barrel.
- The MCP tools all go through `makeApiClient()` in `mcp-server/lib/context.js`, which returns an instance. No MCP tool imports api.js directly.
- `DEFAULT_API_CONFIG` is exported. Keep it in `client.js` or a dedicated `config.js`.

## Risks

- Touches every test file that imports api.js. If the barrel re-export is correct, most won't need changing, but verify.
- The retry/circuit-breaker integration lives inside `makeRequest`. Keep it there; don't split it into its own middleware unless you also split the tests.

## Suggested approach

1. Create `src/lib/api/` with a barrel that re-exports everything api.js does today.
2. Move methods one domain at a time, updating the barrel after each.
3. Run `npm test` after each move. The tests are the safety net.
4. When all methods are moved, delete the old `src/lib/api.js` and update the barrel to compose the class from the domain modules.

## Acceptance

`npm run verify` green. `git diff --stat` shows the old api.js replaced by the directory. No import site outside `src/lib/api/` changes.
